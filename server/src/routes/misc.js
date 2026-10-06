import { Router } from "express";
import { z } from "zod";
import { all, one, query } from "../db.js";
import { requireAuth, HttpError } from "../auth.js";
import { CITY_NAMES, normalizeCity } from "../cities.js";
import { BODY_TYPES, findDrivers, driverProfile } from "../matching.js";
import { logistAnalytics } from "../analytics.js";
import { chat } from "../assistant/chat.js";
import { claude } from "../assistant/claude.js";

export const miscRouter = Router();

miscRouter.get("/meta", (_req, res) => {
  res.json({ cities: CITY_NAMES, bodyTypes: BODY_TYPES, assistantMode: claude ? "claude" : "rules" });
});

// ---------- Водители ----------

miscRouter.get("/drivers", requireAuth("logist", "admin"), async (req, res) => {
  res.json(await findDrivers({
    city: normalizeCity(req.query.city), body: req.query.body || undefined,
    minCapacity: Number(req.query.minCapacity) || undefined, status: req.query.status || "any",
    verifiedOnly: req.query.verified === "1", limit: 200,
  }));
});

miscRouter.get("/drivers/:id", requireAuth("logist", "admin"), async (req, res) => {
  const d = await driverProfile(req.params.id);
  if (!d) throw new HttpError(404, "Водитель не найден");
  const reviews = await all(
    `SELECT r.rating, r.comment, r.created_at, c.code, c.from_city, c.to_city, u.company
     FROM reviews r JOIN cargos c ON c.id = r.cargo_id JOIN users u ON u.id = r.logist_id
     WHERE r.driver_id = $1 ORDER BY r.created_at DESC LIMIT 20`, [d.id]);
  const recentTrips = await all(
    `SELECT code, from_city, to_city, status, load_date, price FROM cargos WHERE driver_id = $1 ORDER BY load_date DESC LIMIT 10`, [d.id]);
  const { n } = await one("SELECT COUNT(*) AS n FROM reviews WHERE driver_id = $1", [d.id]);
  // trips — число рейсов из профиля; список последних рейсов отдаём отдельным полем
  res.json({ ...d, reviews, recent_trips: recentTrips, reviews_count: n });
});

const DriverPatch = z.object({
  status: z.enum(["free", "busy", "offline"]).optional(),
  city: z.string().optional(),
  vehicleModel: z.string().trim().max(60).optional(),
  body: z.enum(BODY_TYPES).optional(),
  capacity: z.coerce.number().positive().max(80).optional(),
  volume: z.coerce.number().positive().max(200).optional(),
  plate: z.string().trim().max(20).optional(),
  directions: z.string().trim().max(200).optional(),
  name: z.string().trim().min(2).max(80).optional(),
});

miscRouter.patch("/me/driver", requireAuth("driver"), async (req, res) => {
  const d = DriverPatch.parse(req.body);
  const city = d.city !== undefined ? normalizeCity(d.city) : undefined;
  if (d.city !== undefined && !city) throw new HttpError(400, `Город «${d.city}» не найден`);
  const active = await one("SELECT code FROM cargos WHERE driver_id = $1 AND status IN ('assigned','loading','in_transit') LIMIT 1", [req.user.id]);
  if (d.status === "free" && active) throw new HttpError(409, `У вас активный рейс ${active.code}. Статус «свободен» станет доступен после доставки`);
  const fields = { status: d.status, city, vehicle_model: d.vehicleModel, body: d.body, capacity: d.capacity, volume: d.volume, plate: d.plate, directions: d.directions };
  const set = [], params = [req.user.id];
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) { params.push(v); set.push(`${k} = $${params.length}`); }
  // Город выбран вручную: GPS-точка старше 30 минут ему противоречит — сбрасываем, иначе подбор считал бы от неё
  if (city) set.push(`last_lat = CASE WHEN last_position_at > now() - interval '30 minutes' THEN last_lat END`,
    `last_lon = CASE WHEN last_position_at > now() - interval '30 minutes' THEN last_lon END`,
    `last_position_at = CASE WHEN last_position_at > now() - interval '30 minutes' THEN last_position_at END`);
  if (set.length) await query(`UPDATE drivers SET ${set.join(", ")}, updated_at = now() WHERE user_id = $1`, params);
  if (d.name) await query("UPDATE users SET name = $2 WHERE id = $1", [req.user.id, d.name]);
  res.json(await one("SELECT * FROM drivers WHERE user_id = $1", [req.user.id]));
});

// ---------- Уведомления ----------

miscRouter.get("/notifications", requireAuth(), async (req, res) => {
  const items = await all("SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [req.user.id]);
  res.json({ items, unread: items.filter((n) => !n.read).length });
});

miscRouter.post("/notifications/read", requireAuth(), async (req, res) => {
  const id = req.body?.id;
  if (id) await query("UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2", [id, req.user.id]);
  else await query("UPDATE notifications SET read = true WHERE user_id = $1", [req.user.id]);
  res.json({ ok: true });
});

// ---------- Аналитика ----------

miscRouter.get("/analytics", requireAuth("logist", "admin"), async (req, res) => {
  const months = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
  res.json(await logistAnalytics(req.user, months));
});

// ---------- Ассистент ----------

const ChatBody = z.object({
  message: z.string().trim().min(1, "Напишите вопрос").max(2000),
  conversationId: z.string().uuid().optional().nullable(),
});

miscRouter.post("/assistant", requireAuth(), async (req, res) => {
  const { message, conversationId } = ChatBody.parse(req.body);
  res.json(await chat(req.user, conversationId, message));
});

// ---------- Админ ----------

miscRouter.get("/admin/drivers", requireAuth("admin"), async (req, res) => {
  const verify = req.query.verify;
  res.json(await all(
    `SELECT u.id, u.name, u.phone, u.created_at, d.* FROM drivers d JOIN users u ON u.id = d.user_id
     ${verify ? "WHERE d.verify = $1" : ""} ORDER BY (d.verify = 'pending') DESC, u.created_at DESC`,
    verify ? [verify] : [],
  ));
});

miscRouter.post("/admin/drivers/:id/verify", requireAuth("admin"), async (req, res) => {
  const verify = z.enum(["verified", "rejected", "pending"]).parse(req.body?.verify);
  const r = await query("UPDATE drivers SET verify = $2, updated_at = now() WHERE user_id = $1", [req.params.id, verify]);
  if (!r.rowCount) throw new HttpError(404, "Водитель не найден");
  await query(
    "INSERT INTO notifications (user_id, title, body) VALUES ($1, $2, $3)",
    [req.params.id, verify === "verified" ? "Документы проверены" : "Документы не приняты",
      verify === "verified" ? "Теперь логисты видят у вас отметку «Проверен»" : "Загрузите документы заново или свяжитесь с поддержкой"],
  );
  res.json({ ok: true });
});
