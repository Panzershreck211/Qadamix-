import { Router } from "express";
import { z } from "zod";
import { all, one, query, tx } from "../db.js";
import { requireAuth, HttpError } from "../auth.js";
import { CITIES, nearestCity, roadKmFromPoint, straightKm } from "../cities.js";

export const gpsRouter = Router();

const ACTIVE = ["assigned", "loading", "in_transit"];
const STALE_MIN = 30;          // после 30 минут без точек считаем, что сигнала нет
const CITY_SNAP_KM = 60;       // в радиусе 60 км от города водитель считается «в городе»
const AVG_SPEED_FALLBACK = 60; // км/ч, если по треку скорость не посчитать
const MAX_TRACK_POINTS = 600;  // столько точек отдаём на карту (прореживаем длинные треки)

const Point = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  speed: z.number().min(0).max(250).nullish(),      // км/ч
  heading: z.number().min(0).max(360).nullish(),
  accuracy: z.number().min(0).max(100000).nullish(), // м
  recordedAt: z.string().datetime({ offset: true }),
});
const Batch = z.object({ points: z.array(Point).min(1).max(500) });

/** Приём точек от приложения водителя. Пачкой — чтобы после офлайна отправить всё накопленное. */
gpsRouter.post("/me/positions", requireAuth("driver"), async (req, res) => {
  const { points } = Batch.parse(req.body);
  const now = Date.now();
  const valid = points
    .filter((p) => (p.accuracy ?? 0) <= 2000) // точки с точностью хуже 2 км не берём
    .filter((p) => { const t = Date.parse(p.recordedAt); return t <= now + 5 * 60000 && t >= now - 7 * 86400000; })
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  if (!valid.length) return res.json({ accepted: 0 });

  const active = await one(
    `SELECT id, code, to_city, status FROM cargos WHERE driver_id = $1 AND status = ANY($2) ORDER BY assigned_at DESC LIMIT 1`,
    [req.user.id, ACTIVE],
  );
  const last = valid.at(-1);
  const near = nearestCity(last.lat, last.lon);

  const accepted = await tx(async (c) => {
    let n = 0;
    for (const p of valid) {
      const r = await query(
        `INSERT INTO positions (driver_id, cargo_id, lat, lon, speed_kmh, heading, accuracy_m, recorded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (driver_id, recorded_at) DO NOTHING`,
        [req.user.id, active?.id ?? null, p.lat, p.lon, p.speed ?? null, p.heading ?? null, p.accuracy ?? null, p.recordedAt], c,
      );
      n += r.rowCount;
    }
    // Последняя точка — только если она новее уже известной (пачки могут прийти не по порядку)
    await query(
      `UPDATE drivers SET last_lat = $2, last_lon = $3, last_speed_kmh = $4, last_position_at = $5, gps_enabled = true,
              city = CASE WHEN $6::text IS NOT NULL THEN $6 ELSE city END, updated_at = now()
       WHERE user_id = $1 AND (last_position_at IS NULL OR last_position_at < $5)`,
      [req.user.id, last.lat, last.lon, last.speed ?? null, last.recordedAt, near.km <= CITY_SNAP_KM ? near.name : null], c,
    );
    return n;
  });
  res.json({ accepted, cargo: active?.code ?? null, nearestCity: near });
});

gpsRouter.patch("/me/gps", requireAuth("driver"), async (req, res) => {
  const enabled = z.boolean().parse(req.body?.enabled);
  await query("UPDATE drivers SET gps_enabled = $2 WHERE user_id = $1", [req.user.id, enabled]);
  res.json({ enabled });
});

/** Сводка трека рейса: пройдено, осталось, прогресс, ETA, ближайший город, свежесть сигнала. */
export async function trackSummary(cargo, { withPoints = true } = {}) {
  const pts = await all(
    `SELECT lat, lon, speed_kmh, recorded_at FROM positions WHERE cargo_id = $1 ORDER BY recorded_at`,
    [cargo.id],
  );
  let last = pts.at(-1) ?? null;
  // Для активного рейса берём и последнюю точку водителя (могла прийти до привязки к рейсу)
  if (ACTIVE.includes(cargo.status) && cargo.driver_id) {
    const d = await one("SELECT last_lat AS lat, last_lon AS lon, last_speed_kmh AS speed_kmh, last_position_at AS recorded_at FROM drivers WHERE user_id = $1", [cargo.driver_id]);
    if (d?.lat != null && (!last || new Date(d.recorded_at) > new Date(last.recorded_at))) last = d;
  }

  let traveledKm = 0;
  for (let i = 1; i < pts.length; i++) traveledKm += straightKm([pts[i - 1].lat, pts[i - 1].lon], [pts[i].lat, pts[i].lon]);

  const origin = CITIES[cargo.from_city], dest = CITIES[cargo.to_city];
  const total = cargo.distance_km ?? null;
  let remainingKm = null, progress = null, etaAt = null, avgSpeed = null;
  if (last && dest) {
    remainingKm = roadKmFromPoint(last.lat, last.lon, cargo.to_city);
    if (total) progress = Math.max(0, Math.min(1, 1 - remainingKm / total));
    // Средняя скорость в движении за последние 3 часа трека
    const since = Date.now() - 3 * 3600000;
    const moving = pts.filter((p) => new Date(p.recorded_at) >= since && (p.speed_kmh ?? 0) > 10).map((p) => p.speed_kmh);
    avgSpeed = moving.length >= 3 ? Math.round(moving.reduce((s, v) => s + v, 0) / moving.length) : null;
    if (cargo.status === "in_transit" && remainingKm > 0) {
      // Водитель едет ~11 ч в сутки: учитываем отдых коэффициентом 24/11 для длинных плеч
      const driveH = remainingKm / (avgSpeed ?? AVG_SPEED_FALLBACK);
      const wallH = driveH <= 9 ? driveH : 9 + (driveH - 9) * (24 / 11);
      etaAt = new Date(Date.now() + wallH * 3600000).toISOString();
    }
  }
  const ageMin = last ? Math.round((Date.now() - new Date(last.recorded_at)) / 60000) : null;

  // Прореживание: на карте достаточно ~600 точек
  const step = Math.max(1, Math.ceil(pts.length / MAX_TRACK_POINTS));
  const track = withPoints ? pts.filter((_, i) => i % step === 0 || i === pts.length - 1).map((p) => [p.lat, p.lon]) : undefined;

  return {
    origin: origin ? { city: cargo.from_city, lat: origin[0], lon: origin[1] } : null,
    destination: dest ? { city: cargo.to_city, lat: dest[0], lon: dest[1] } : null,
    last: last ? { lat: last.lat, lon: last.lon, speed_kmh: last.speed_kmh, at: last.recorded_at, age_min: ageMin, nearest: nearestCity(last.lat, last.lon) } : null,
    signal: !last ? "none" : ageMin <= STALE_MIN ? "live" : "stale",
    points: pts.length,
    traveled_km: Math.round(traveledKm),
    remaining_km: remainingKm,
    total_km: total,
    progress,
    avg_speed_kmh: avgSpeed,
    eta_at: etaAt,
    track,
  };
}

gpsRouter.get("/cargos/:code/track", requireAuth(), async (req, res) => {
  const cargo = await one("SELECT * FROM cargos WHERE code = $1", [String(req.params.code).toUpperCase()]);
  if (!cargo) throw new HttpError(404, "Груз не найден");
  const u = req.user;
  const allowed = u.role === "admin" || (u.role === "logist" && cargo.logist_id === u.id) || (u.role === "driver" && cargo.driver_id === u.id);
  if (!allowed) throw new HttpError(403, "Трек доступен заказчику и водителю рейса");
  res.json(await trackSummary(cargo));
});

/**
 * Карта парка для логиста. Приватность: точные координаты — только у водителей на рейсах этого логиста;
 * остальные показаны в своём городе (приблизительно), без живого GPS.
 */
gpsRouter.get("/fleet", requireAuth("logist", "admin"), async (req, res) => {
  const rows = await all(
    `SELECT u.id, u.name, u.phone, d.city, d.status, d.verify, d.rating, d.vehicle_model, d.body, d.capacity,
            d.last_lat, d.last_lon, d.last_speed_kmh, d.last_position_at,
            c.code AS cargo_code, c.from_city, c.to_city, c.status AS cargo_status, c.logist_id
     FROM drivers d JOIN users u ON u.id = d.user_id
     LEFT JOIN cargos c ON c.driver_id = d.user_id AND c.status IN ('assigned','loading','in_transit')`,
  );
  res.json(rows.map((r) => {
    const mine = r.cargo_code && (req.user.role === "admin" || r.logist_id === req.user.id);
    const exact = mine && r.last_lat != null;
    const [lat, lon] = exact ? [r.last_lat, r.last_lon] : CITIES[r.city] ?? [null, null];
    return {
      id: r.id, name: r.name, phone: r.phone, city: r.city, status: r.status, verify: r.verify, rating: r.rating,
      vehicle_model: r.vehicle_model, body: r.body, capacity: r.capacity,
      lat, lon, exact,
      speed_kmh: exact ? r.last_speed_kmh : null,
      position_at: exact ? r.last_position_at : null,
      trip: mine ? { code: r.cargo_code, from_city: r.from_city, to_city: r.to_city, status: r.cargo_status } : null,
    };
  }).filter((r) => r.lat != null));
});
