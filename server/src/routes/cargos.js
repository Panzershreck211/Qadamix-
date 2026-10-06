import { Router } from "express";
import { z } from "zod";
import { all, one, query, tx, notify } from "../db.js";
import { requireAuth, HttpError } from "../auth.js";
import { normalizeCity, roadDistanceKm, nearestCity } from "../cities.js";
import { BODY_TYPES, rankDriversForCargo, scoreCargoForDriver, estimateRate } from "../matching.js";
import { parseCargoText } from "../assistant/parse.js";

export const cargosRouter = Router();

export const STATUS_LABELS = {
  open: "Ищем машину",
  assigned: "Машина назначена",
  loading: "На загрузке",
  in_transit: "В пути",
  delivered: "Доставлен",
  cancelled: "Отменён",
};
// Порядок, в котором водитель продвигает рейс
const TRIP_FLOW = ["assigned", "loading", "in_transit", "delivered"];

const CityField = z.string().transform((v, ctx) => {
  const c = normalizeCity(v);
  if (!c) ctx.addIssue({ code: "custom", message: `Город «${v}» не найден в справочнике` });
  return c;
});

const CargoBody = z.object({
  fromCity: CityField,
  toCity: CityField,
  loadDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата загрузки в формате ГГГГ-ММ-ДД"),
  weight: z.coerce.number().positive("Вес должен быть больше нуля").max(80),
  volume: z.coerce.number().positive().max(200).optional().nullable(),
  body: z.enum(BODY_TYPES, { message: "Выберите тип кузова" }),
  kind: z.string().trim().max(120).optional().nullable(),
  price: z.coerce.number().int().min(0).max(50_000_000),
  notes: z.string().trim().max(1000).optional().nullable(),
});

async function loadCargo(code, client) {
  const cargo = await one(
    `SELECT c.*, u.name AS logist_name, u.company AS logist_company, u.phone AS logist_phone,
            dv.name AS driver_name, dv.phone AS driver_phone,
            d.vehicle_model AS driver_vehicle, d.plate AS driver_plate, d.body AS driver_body, d.capacity AS driver_capacity
     FROM cargos c
     JOIN users u ON u.id = c.logist_id
     LEFT JOIN users dv ON dv.id = c.driver_id
     LEFT JOIN drivers d ON d.user_id = c.driver_id
     WHERE c.code = $1`,
    [String(code).toUpperCase()], client,
  );
  if (!cargo) throw new HttpError(404, `Груз ${code} не найден`);
  return cargo;
}

function assertCanView(user, cargo) {
  if (user.role === "admin") return;
  if (user.role === "logist" && cargo.logist_id === user.id) return;
  if (user.role === "driver" && (cargo.status === "open" || cargo.driver_id === user.id)) return;
  throw new HttpError(403, "Нет доступа к этому грузу");
}

const withLabel = (c) => ({ ...c, status_label: STATUS_LABELS[c.status] });

// ---------- Логист: свои грузы ----------

cargosRouter.get("/cargos", requireAuth("logist", "admin"), async (req, res) => {
  const params = [], where = [];
  if (req.user.role === "logist") { params.push(req.user.id); where.push(`c.logist_id = $${params.length}`); }
  if (req.query.status === "active") where.push(`c.status IN ('open','assigned','loading','in_transit')`);
  else if (req.query.status) { params.push(req.query.status); where.push(`c.status = $${params.length}`); }
  if (req.query.q) {
    params.push(`%${req.query.q}%`);
    where.push(`(c.code ILIKE $${params.length} OR c.from_city ILIKE $${params.length} OR c.to_city ILIKE $${params.length} OR c.kind ILIKE $${params.length})`);
  }
  const rows = await all(
    `SELECT c.id, c.code, c.from_city, c.to_city, c.load_date, c.weight, c.body, c.kind, c.price, c.distance_km,
            c.status, c.created_at, c.driver_id, dv.name AS driver_name,
            (SELECT COUNT(*) FROM offers o WHERE o.cargo_id = c.id AND o.status = 'pending' AND o.source = 'driver') AS offers_count
     FROM cargos c LEFT JOIN users dv ON dv.id = c.driver_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY CASE c.status WHEN 'open' THEN 0 WHEN 'assigned' THEN 1 WHEN 'loading' THEN 1 WHEN 'in_transit' THEN 1 ELSE 2 END,
              c.load_date DESC, c.id DESC
     LIMIT 300`,
    params,
  );
  res.json(rows.map(withLabel));
});

cargosRouter.post("/cargos", requireAuth("logist"), async (req, res) => {
  const d = CargoBody.parse(req.body);
  if (d.fromCity === d.toCity) throw new HttpError(400, "Город загрузки и выгрузки совпадают");
  const cargo = await one(
    `INSERT INTO cargos (logist_id, from_city, to_city, load_date, weight, volume, body, kind, price, notes, distance_km)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [req.user.id, d.fromCity, d.toCity, d.loadDate, d.weight, d.volume ?? null, d.body, d.kind ?? null, d.price, d.notes ?? null,
      roadDistanceKm(d.fromCity, d.toCity)],
  );
  // Свободным подходящим водителям — уведомление о новом грузе рядом
  const top = (await rankDriversForCargo(cargo, { limit: 5, onlyAvailable: true })).filter((m) => m.score >= 70);
  for (const m of top) {
    await notify(m.id, "Новый груз рядом", `${cargo.from_city} → ${cargo.to_city}, ${cargo.weight} т, ${cargo.body}, ${cargo.price.toLocaleString("ru-RU")} ₸`, `/cargo/${cargo.code}`);
  }
  res.status(201).json({ ...withLabel(cargo), notifiedDrivers: top.length });
});

cargosRouter.post("/cargos/parse", requireAuth("logist"), async (req, res) => {
  const text = z.string().trim().min(5, "Вставьте текст заявки").max(4000).parse(req.body?.text);
  res.json(await parseCargoText(text));
});

cargosRouter.get("/rate-estimate", requireAuth(), async (req, res) => {
  const est = await estimateRate({
    fromCity: normalizeCity(req.query.from), toCity: normalizeCity(req.query.to),
    weight: Number(req.query.weight) || 20, body: req.query.body || "Тент",
  });
  if (!est) throw new HttpError(400, "Не удалось посчитать: проверьте города");
  res.json(est);
});

cargosRouter.get("/cargos/:code", requireAuth(), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  assertCanView(req.user, cargo);
  const events = await all(
    `SELECT e.id, e.status, e.city, e.note, e.created_at, u.name AS author FROM trip_events e
     JOIN users u ON u.id = e.author_id WHERE e.cargo_id = $1 ORDER BY e.created_at`,
    [cargo.id],
  );
  const review = await one("SELECT rating, comment, created_at FROM reviews WHERE cargo_id = $1", [cargo.id]);
  const out = { ...withLabel(cargo), events: events.map((e) => ({ ...e, status_label: STATUS_LABELS[e.status] ?? "Комментарий" })), review };
  // Водителю, не назначенному на груз, контакты логиста не раскрываем до принятия отклика
  if (req.user.role === "driver" && cargo.driver_id !== req.user.id) {
    delete out.logist_phone;
    const me = await one("SELECT * FROM drivers WHERE user_id = $1", [req.user.id]);
    out.match = scoreCargoForDriver(cargo, me);
    out.myOffer = await one("SELECT id, price, comment, status, source FROM offers WHERE cargo_id = $1 AND driver_id = $2", [cargo.id, req.user.id]);
  }
  res.json(out);
});

cargosRouter.patch("/cargos/:code", requireAuth("logist", "admin"), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  assertCanView(req.user, cargo);
  if (req.body?.status === "cancelled") {
    if (!["open", "assigned"].includes(cargo.status)) throw new HttpError(409, "Рейс уже начался — отменить нельзя");
    await tx(async (c) => {
      await query("UPDATE cargos SET status = 'cancelled' WHERE id = $1", [cargo.id], c);
      await query("UPDATE offers SET status = 'rejected' WHERE cargo_id = $1 AND status = 'pending'", [cargo.id], c);
      if (cargo.driver_id) {
        await query("UPDATE drivers SET status = 'free' WHERE user_id = $1", [cargo.driver_id], c);
        await notify(cargo.driver_id, "Рейс отменён", `Логист отменил груз ${cargo.code}`, `/cargo/${cargo.code}`, c);
      }
    });
    return res.json(withLabel(await loadCargo(cargo.code)));
  }
  if (cargo.status !== "open") throw new HttpError(409, "Редактировать можно только груз, для которого ещё ищут машину");
  const d = CargoBody.partial().parse(req.body);
  const merged = {
    from_city: d.fromCity ?? cargo.from_city, to_city: d.toCity ?? cargo.to_city, load_date: d.loadDate ?? cargo.load_date,
    weight: d.weight ?? cargo.weight, volume: d.volume ?? cargo.volume, body: d.body ?? cargo.body, kind: d.kind ?? cargo.kind,
    price: d.price ?? cargo.price, notes: d.notes ?? cargo.notes,
  };
  await query(
    `UPDATE cargos SET from_city=$2, to_city=$3, load_date=$4, weight=$5, volume=$6, body=$7, kind=$8, price=$9, notes=$10, distance_km=$11 WHERE id=$1`,
    [cargo.id, merged.from_city, merged.to_city, merged.load_date, merged.weight, merged.volume, merged.body, merged.kind, merged.price, merged.notes,
      roadDistanceKm(merged.from_city, merged.to_city)],
  );
  res.json(withLabel(await loadCargo(cargo.code)));
});

cargosRouter.get("/cargos/:code/matches", requireAuth("logist", "admin"), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  assertCanView(req.user, cargo);
  const invited = new Map((await all("SELECT driver_id, status, source FROM offers WHERE cargo_id = $1", [cargo.id])).map((o) => [o.driver_id, o]));
  const ranked = await rankDriversForCargo(cargo, { limit: Number(req.query.limit) || 12 });
  res.json(ranked.map((d) => ({ ...d, offer: invited.get(d.id) ?? null })));
});

cargosRouter.get("/cargos/:code/offers", requireAuth("logist", "admin"), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  assertCanView(req.user, cargo);
  const offers = await all(
    `SELECT o.id, o.price, o.comment, o.status, o.source, o.created_at,
            u.id AS driver_id, u.name AS driver_name, u.phone AS driver_phone,
            d.city, d.rating, d.trips, d.verify, d.vehicle_model, d.body, d.capacity, d.status AS driver_status
     FROM offers o JOIN users u ON u.id = o.driver_id JOIN drivers d ON d.user_id = o.driver_id
     WHERE o.cargo_id = $1 ORDER BY (o.status = 'pending') DESC, o.price`,
    [cargo.id],
  );
  res.json(offers);
});

cargosRouter.post("/cargos/:code/invite", requireAuth("logist"), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  assertCanView(req.user, cargo);
  if (cargo.status !== "open") throw new HttpError(409, "Машина уже назначена");
  const driverId = z.coerce.number().int().parse(req.body?.driverId);
  const driver = await one("SELECT user_id FROM drivers WHERE user_id = $1", [driverId]);
  if (!driver) throw new HttpError(404, "Водитель не найден");
  await query(
    `INSERT INTO offers (cargo_id, driver_id, price, source) VALUES ($1, $2, $3, 'invite') ON CONFLICT (cargo_id, driver_id) DO NOTHING`,
    [cargo.id, driverId, cargo.price],
  );
  await notify(driverId, "Вам предложили рейс", `${cargo.from_city} → ${cargo.to_city}, ${cargo.weight} т, ${cargo.price.toLocaleString("ru-RU")} ₸. Откликнитесь, если готовы`, `/cargo/${cargo.code}`);
  res.json({ ok: true });
});

async function loadOfferForLogist(offerId, user) {
  const offer = await one(
    `SELECT o.*, c.code, c.logist_id, c.status AS cargo_status, c.from_city, c.to_city FROM offers o JOIN cargos c ON c.id = o.cargo_id WHERE o.id = $1`,
    [offerId],
  );
  if (!offer) throw new HttpError(404, "Отклик не найден");
  if (user.role !== "admin" && offer.logist_id !== user.id) throw new HttpError(403, "Нет доступа");
  return offer;
}

cargosRouter.post("/offers/:id/accept", requireAuth("logist"), async (req, res) => {
  const offer = await loadOfferForLogist(req.params.id, req.user);
  if (offer.source !== "driver" || offer.status !== "pending") throw new HttpError(409, "Этот отклик нельзя принять");
  await tx(async (c) => {
    // Блокируем груз, чтобы два логиста/вкладки не назначили разных водителей
    const cur = await one("SELECT status FROM cargos WHERE id = $1 FOR UPDATE", [offer.cargo_id], c);
    if (cur.status !== "open") throw new HttpError(409, "Машина уже назначена");
    await query("UPDATE cargos SET status='assigned', driver_id=$2, price=$3, assigned_at=now() WHERE id=$1", [offer.cargo_id, offer.driver_id, offer.price], c);
    await query("UPDATE offers SET status = CASE WHEN id = $2 THEN 'accepted' ELSE 'rejected' END WHERE cargo_id = $1 AND status = 'pending'", [offer.cargo_id, offer.id], c);
    await query("UPDATE drivers SET status = 'busy', updated_at = now() WHERE user_id = $1", [offer.driver_id], c);
    await query("INSERT INTO trip_events (cargo_id, author_id, status, note) VALUES ($1, $2, 'assigned', $3)", [offer.cargo_id, req.user.id, `Ставка ${offer.price.toLocaleString("ru-RU")} ₸`], c);
    await notify(offer.driver_id, "Ваш отклик принят", `Рейс ${offer.code} ${offer.from_city} → ${offer.to_city}. Отмечайте статус в приложении`, `/trip/${offer.code}`, c);
    const losers = await all("SELECT driver_id FROM offers WHERE cargo_id = $1 AND status = 'rejected' AND source = 'driver' AND id <> $2", [offer.cargo_id, offer.id], c);
    for (const l of losers) await notify(l.driver_id, "Груз забрали", `По грузу ${offer.code} выбран другой перевозчик`, null, c);
  });
  res.json(withLabel(await loadCargo(offer.code)));
});

cargosRouter.post("/offers/:id/reject", requireAuth("logist"), async (req, res) => {
  const offer = await loadOfferForLogist(req.params.id, req.user);
  if (offer.status !== "pending") throw new HttpError(409, "Отклик уже обработан");
  await query("UPDATE offers SET status = 'rejected' WHERE id = $1", [offer.id]);
  if (offer.source === "driver") await notify(offer.driver_id, "Отклик отклонён", `Логист выбрал другой вариант по грузу ${offer.code}`);
  res.json({ ok: true });
});

const ReviewBody = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() });

cargosRouter.post("/cargos/:code/review", requireAuth("logist"), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  assertCanView(req.user, cargo);
  if (cargo.status !== "delivered") throw new HttpError(409, "Отзыв можно оставить после доставки");
  const r = ReviewBody.parse(req.body);
  await tx(async (c) => {
    await query(
      `INSERT INTO reviews (cargo_id, logist_id, driver_id, rating, comment) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (cargo_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment`,
      [cargo.id, req.user.id, cargo.driver_id, r.rating, r.comment ?? null], c,
    );
    await query(
      `UPDATE drivers SET rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE driver_id = $1) WHERE user_id = $1`,
      [cargo.driver_id], c,
    );
    await notify(cargo.driver_id, "Новый отзыв", `${"★".repeat(r.rating)} по рейсу ${cargo.code}`, null, c);
  });
  res.json({ ok: true });
});

// ---------- Водитель: лента грузов, отклики, рейсы ----------

cargosRouter.get("/market", requireAuth("driver"), async (req, res) => {
  const me = await one("SELECT * FROM drivers WHERE user_id = $1", [req.user.id]);
  const params = [req.user.id], where = ["c.status = 'open'"];
  const from = normalizeCity(req.query.from), to = normalizeCity(req.query.to);
  if (from) { params.push(from); where.push(`c.from_city = $${params.length}`); }
  if (to) { params.push(to); where.push(`c.to_city = $${params.length}`); }
  if (req.query.body) { params.push(req.query.body); where.push(`c.body = $${params.length}`); }
  const rows = await all(
    `SELECT c.id, c.code, c.from_city, c.to_city, c.load_date, c.weight, c.volume, c.body, c.kind, c.price, c.distance_km, c.notes,
            u.company AS logist_company, o.status AS my_offer_status, o.source AS my_offer_source
     FROM cargos c JOIN users u ON u.id = c.logist_id
     LEFT JOIN offers o ON o.cargo_id = c.id AND o.driver_id = $1
     WHERE ${where.join(" AND ")} ORDER BY c.load_date LIMIT 200`,
    params,
  );
  const scored = rows.map((c) => ({ ...c, match: scoreCargoForDriver(c, me) }));
  // «Подходящие» по умолчанию: только то, что машина реально может везти
  const list = req.query.all === "1" ? scored : scored.filter((c) => c.match.score >= 50);
  list.sort((a, b) => req.query.sort === "date" ? a.load_date.localeCompare(b.load_date) : b.match.score - a.match.score);
  res.json(list);
});

const OfferBody = z.object({ price: z.coerce.number().int().min(0).max(50_000_000), comment: z.string().trim().max(500).optional() });

cargosRouter.post("/cargos/:code/offers", requireAuth("driver"), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  if (cargo.status !== "open") throw new HttpError(409, "На этот груз уже назначена машина");
  const { price, comment } = OfferBody.parse(req.body);
  const offer = await one(
    `INSERT INTO offers (cargo_id, driver_id, price, comment, source, status) VALUES ($1,$2,$3,$4,'driver','pending')
     ON CONFLICT (cargo_id, driver_id) DO UPDATE SET price = EXCLUDED.price, comment = EXCLUDED.comment, source = 'driver', status = 'pending', created_at = now()
     RETURNING *`,
    [cargo.id, req.user.id, price, comment ?? null],
  );
  await notify(cargo.logist_id, "Новый отклик", `${req.user.name} готов везти ${cargo.code} за ${price.toLocaleString("ru-RU")} ₸`, `/cargos/${cargo.code}`);
  res.status(201).json(offer);
});

cargosRouter.delete("/offers/:id", requireAuth("driver"), async (req, res) => {
  const r = await query("UPDATE offers SET status = 'withdrawn' WHERE id = $1 AND driver_id = $2 AND status = 'pending'", [req.params.id, req.user.id]);
  if (!r.rowCount) throw new HttpError(404, "Активный отклик не найден");
  res.json({ ok: true });
});

cargosRouter.get("/my/offers", requireAuth("driver"), async (req, res) => {
  res.json(await all(
    `SELECT o.id, o.price, o.comment, o.status, o.source, o.created_at,
            c.code, c.from_city, c.to_city, c.load_date, c.weight, c.body, c.price AS cargo_price, c.status AS cargo_status
     FROM offers o JOIN cargos c ON c.id = o.cargo_id WHERE o.driver_id = $1
     ORDER BY (o.status = 'pending') DESC, o.created_at DESC LIMIT 100`,
    [req.user.id],
  ));
});

cargosRouter.get("/my/trips", requireAuth("driver"), async (req, res) => {
  const rows = await all(
    `SELECT c.id, c.code, c.from_city, c.to_city, c.load_date, c.weight, c.body, c.kind, c.price, c.distance_km, c.status,
            c.assigned_at, c.delivered_at, u.name AS logist_name, u.company AS logist_company, u.phone AS logist_phone
     FROM cargos c JOIN users u ON u.id = c.logist_id WHERE c.driver_id = $1
     ORDER BY (c.status IN ('assigned','loading','in_transit')) DESC, c.load_date DESC LIMIT 100`,
    [req.user.id],
  );
  res.json(rows.map(withLabel));
});

const EventBody = z.object({
  status: z.enum(["loading", "in_transit", "delivered", "note"]),
  city: z.string().optional(),
  note: z.string().trim().max(500).optional(),
});

cargosRouter.post("/cargos/:code/events", requireAuth("driver"), async (req, res) => {
  const cargo = await loadCargo(req.params.code);
  if (cargo.driver_id !== req.user.id) throw new HttpError(403, "Это не ваш рейс");
  if (!TRIP_FLOW.slice(0, 3).includes(cargo.status)) throw new HttpError(409, "Рейс завершён или отменён");
  const e = EventBody.parse(req.body);
  let city = e.city ? normalizeCity(e.city) ?? e.city : null;
  if (!city) {
    // Город не указан — берём ближайший к свежей GPS-точке водителя (до 60 км)
    const d = await one("SELECT last_lat, last_lon, last_position_at FROM drivers WHERE user_id = $1", [req.user.id]);
    if (d?.last_lat != null && Date.now() - new Date(d.last_position_at) < 30 * 60000) {
      const near = nearestCity(d.last_lat, d.last_lon);
      if (near.km <= 60) city = near.name;
    }
  }
  if (e.status !== "note" && TRIP_FLOW.indexOf(e.status) <= TRIP_FLOW.indexOf(cargo.status)) {
    throw new HttpError(409, `Рейс уже в статусе «${STATUS_LABELS[cargo.status]}»`);
  }
  await tx(async (c) => {
    await query("INSERT INTO trip_events (cargo_id, author_id, status, city, note) VALUES ($1,$2,$3,$4,$5)", [cargo.id, req.user.id, e.status, city, e.note ?? null], c);
    if (e.status !== "note") {
      await query(`UPDATE cargos SET status = $2 ${e.status === "delivered" ? ", delivered_at = now()" : ""} WHERE id = $1`, [cargo.id, e.status], c);
    }
    if (e.status === "delivered") {
      // Машина в городе выгрузки. Старая GPS-точка (до доставки) больше не отражает положение — сбрасываем её
      await query(
        `UPDATE drivers SET status = 'free', trips = trips + 1, city = $2, updated_at = now(),
           last_lat = CASE WHEN last_position_at > now() - interval '30 minutes' THEN last_lat END,
           last_lon = CASE WHEN last_position_at > now() - interval '30 minutes' THEN last_lon END,
           last_position_at = CASE WHEN last_position_at > now() - interval '30 minutes' THEN last_position_at END
         WHERE user_id = $1`,
        [req.user.id, cargo.to_city], c,
      );
    } else if (city && normalizeCity(city)) {
      await query("UPDATE drivers SET city = $2, updated_at = now() WHERE user_id = $1", [req.user.id, normalizeCity(city)], c);
    }
    const label = e.status === "note" ? "Комментарий водителя" : STATUS_LABELS[e.status];
    await notify(cargo.logist_id, `${cargo.code}: ${label}`, [city, e.note].filter(Boolean).join(" · ") || `${cargo.from_city} → ${cargo.to_city}`, `/cargos/${cargo.code}`, c);
  });
  res.json(withLabel(await loadCargo(cargo.code)));
});
