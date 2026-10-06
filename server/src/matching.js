import { roadDistanceKm, roadKmFromPoint } from "./cities.js";

const GPS_FRESH_MS = 6 * 3600000; // координатам моложе 6 часов доверяем больше, чем городу из профиля
const hasFreshGps = (d) => d.last_lat != null && d.last_position_at && Date.now() - new Date(d.last_position_at) < GPS_FRESH_MS;
import { all, one } from "./db.js";

export const BODY_TYPES = ["Тент", "Борт", "Рефрижератор", "Изотерм", "Самосвал", "Контейнер", "Низкорамный трал", "Цистерна"];

// Какие кузова могут взять груз, заявленный под данный кузов (кроме точного совпадения).
const COMPATIBLE = {
  "Тент": ["Борт"],          // борт с тентом часто подходит под тентовый груз
  "Борт": ["Тент", "Низкорамный трал"],
  "Изотерм": ["Рефрижератор"], // реф может работать как изотерм
};

export function bodyFits(cargoBody, driverBody) {
  if (!cargoBody || !driverBody) return "no";
  if (cargoBody === driverBody) return "exact";
  return (COMPATIBLE[cargoBody] || []).includes(driverBody) ? "partial" : "no";
}

/**
 * Оценка водителя под груз: 0–100 и человекочитаемые причины.
 * Жёсткие несоответствия (кузов, тоннаж) не отсекаются, а сильно штрафуются,
 * чтобы логист видел, почему машина не подходит.
 */
export function scoreDriver(driver, cargo) {
  const reasons = [];
  let score = 100;

  const fit = bodyFits(cargo.body, driver.body);
  if (fit === "exact") reasons.push(`кузов ${driver.body} совпадает`);
  else if (fit === "partial") { score -= 12; reasons.push(`кузов ${driver.body} вместо ${cargo.body}`); }
  else { score -= 45; reasons.push(`кузов ${driver.body ?? "не указан"} не подходит`); }

  if (driver.capacity == null || driver.capacity < cargo.weight) {
    score -= 45;
    reasons.push(`грузоподъёмность ${driver.capacity ?? "?"} т меньше ${cargo.weight} т`);
  } else if (driver.capacity > cargo.weight * 2) {
    score -= 5;
    reasons.push(`машина ${driver.capacity} т крупнее нужного`);
  }

  const gps = hasFreshGps(driver);
  const pickupKm = gps ? roadKmFromPoint(driver.last_lat, driver.last_lon, cargo.from_city) : roadDistanceKm(driver.city, cargo.from_city);
  if (pickupKm == null) score -= 10;
  else {
    score -= Math.min(25, Math.round(pickupKm / 40));
    reasons.push(pickupKm <= 30 ? `уже в городе загрузки${gps ? " (GPS)" : ""}` : `${pickupKm} км до загрузки${gps ? " по GPS" : ""}`);
  }

  if (driver.status === "busy") { score -= 20; reasons.push("сейчас в рейсе"); }
  if (driver.status === "offline") { score -= 30; reasons.push("не на линии"); }

  if (driver.verify === "verified") reasons.push("документы проверены");
  else if (driver.verify === "pending") { score -= 8; reasons.push("документы на проверке"); }
  else { score -= 15; reasons.push("документы не проверены"); }

  if (driver.rating) score += Math.round((driver.rating - 4.5) * 6);

  return { score: Math.max(0, Math.min(100, score)), pickupKm, reasons };
}

const DRIVER_SELECT = `
  SELECT u.id, u.name, u.phone, d.city, d.status, d.verify, d.rating, d.trips,
         d.vehicle_model, d.body, d.capacity, d.volume, d.plate, d.directions,
         d.last_lat, d.last_lon, d.last_speed_kmh, d.last_position_at, d.gps_enabled
  FROM drivers d JOIN users u ON u.id = d.user_id`;

export async function rankDriversForCargo(cargo, { limit = 10, onlyAvailable = false } = {}) {
  const drivers = await all(DRIVER_SELECT + (onlyAvailable ? " WHERE d.status = 'free'" : ""));
  return drivers
    .map((d) => ({ ...d, ...scoreDriver(d, cargo) }))
    .sort((a, b) => b.score - a.score || (a.pickupKm ?? 1e9) - (b.pickupKm ?? 1e9))
    .slice(0, limit);
}

export async function findDrivers({ city, body, minCapacity, status, verifiedOnly, limit = 20 } = {}) {
  const where = [], params = [];
  if (city) { params.push(city); where.push(`d.city = $${params.length}`); }
  if (body) { params.push(body); where.push(`d.body = $${params.length}`); }
  if (minCapacity) { params.push(minCapacity); where.push(`d.capacity >= $${params.length}`); }
  if (status && status !== "any") { params.push(status); where.push(`d.status = $${params.length}`); }
  if (verifiedOnly) where.push(`d.verify = 'verified'`);
  params.push(limit);
  return all(
    `${DRIVER_SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY (d.status = 'free') DESC, d.rating DESC LIMIT $${params.length}`,
    params,
  );
}

/** Насколько открытый груз подходит конкретному водителю (для ленты в приложении). */
export function scoreCargoForDriver(cargo, driver) {
  return scoreDriver({ ...driver, status: "free" }, cargo);
}

/**
 * Оценка ставки по истории завершённых рейсов: медиана ₸/км по похожим кузовам,
 * поправка на тоннаж. Если истории мало — базовый тариф.
 */
export async function estimateRate({ fromCity, toCity, weight = 20, body = "Тент" }) {
  const km = roadDistanceKm(fromCity, toCity);
  if (km == null || km === 0) return null;
  const rows = await all(
    `SELECT price::float / NULLIF(distance_km, 0) AS per_km, body, weight, distance_km
     FROM cargos WHERE status = 'delivered' AND distance_km > 0
       AND delivered_at > now() - interval '180 days'`,
  );
  const median = (arr) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  // Поправки: тоннаж (цена растёт медленнее веса) и длина плеча (короткие рейсы дороже за км)
  const weightK = (w) => (w <= 5 ? 0.7 : w <= 10 ? 0.82 : w <= 20 ? 1 : 1.12);
  const haulK = (d) => (d < 300 ? 1.3 : d < 600 ? 1.15 : 1);
  const similarRows = rows.filter((r) => r.body === body);
  const useSimilar = similarRows.length >= 5;
  const pool = useSimilar ? similarRows : rows;
  // История приводится к «эталону» (20 т, длинное плечо), чтобы не учитывать тоннаж и плечо дважды
  const basePerKm = pool.length >= 5 ? median(pool.map((r) => r.per_km / weightK(r.weight) / haulK(r.distance_km))) : 240;
  const bodyK = { "Рефрижератор": 1.2, "Изотерм": 1.1, "Низкорамный трал": 1.6, "Цистерна": 1.3 }[body] ?? 1;
  const MIN_TRIP = 40000; // дешевле рейс не бывает: подача, погрузка, время водителя
  const raw = km * basePerKm * (useSimilar ? 1 : bodyK) * weightK(weight) * haulK(km);
  const market = Math.max(MIN_TRIP, Math.round(raw / 1000) * 1000);
  return {
    distanceKm: km,
    market,
    low: Math.round((market * 0.92) / 1000) * 1000,
    high: Math.round((market * 1.08) / 1000) * 1000,
    perKm: Math.round(market / km),
    basedOn: pool.length >= 5 ? `${pool.length} завершённых рейсов за 180 дней` : "базовый тариф (мало истории)",
  };
}

export async function openCargosFrom(city, limit = 10) {
  return all(
    `SELECT id, code, from_city, to_city, load_date, weight, body, price, distance_km, kind
     FROM cargos WHERE status = 'open' AND from_city = $1 ORDER BY load_date LIMIT $2`,
    [city, limit],
  );
}

export async function driverProfile(id) {
  return one(DRIVER_SELECT + " WHERE u.id = $1", [id]);
}
