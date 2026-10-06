// Инструменты ассистента: единая точка доступа к данным платформы для Claude и для режима правил.
// Каждый инструмент проверяет роль пользователя — ассистент видит ровно то, что видит сам пользователь.
import { all, one } from "../db.js";
import { normalizeCity, roadDistanceKm, CITIES } from "../cities.js";
import { BODY_TYPES, rankDriversForCargo, findDrivers, estimateRate, scoreCargoForDriver } from "../matching.js";
import { analyticsSummary } from "../analytics.js";
import { trackSummary } from "../routes/gps.js";

const STATUS_LABELS = {
  open: "ищем машину", assigned: "машина назначена", loading: "на загрузке",
  in_transit: "в пути", delivered: "доставлен", cancelled: "отменён",
};

const nullable = (type, extra = {}) => ({ type: [type, "null"], ...extra });
const city = (description) => nullable("string", { description });
const body = nullable("string", { enum: [...BODY_TYPES, null], description: "Тип кузова" });

/** Определения инструментов в формате Claude API (strict: все поля обязательны, необязательные — nullable). */
const DEFS = {
  search_cargos: {
    roles: ["logist", "driver", "admin"],
    description:
      "Поиск грузов. Логисту — его собственные грузы в любом статусе. Водителю — открытые грузы на бирже с оценкой, " +
      "насколько груз подходит его машине. Все фильтры необязательны (null — не фильтровать).",
    properties: {
      from_city: city("Город загрузки"),
      to_city: city("Город выгрузки"),
      body,
      status: nullable("string", { enum: ["open", "active", "delivered", "cancelled", "all", null], description: "Только для логиста: open — ищем машину, active — в работе (назначен/в пути), all — все" }),
      max_weight: nullable("number", { description: "Максимальный вес, т" }),
      limit: nullable("integer", { description: "Сколько вернуть, по умолчанию 10" }),
    },
  },
  find_drivers: {
    roles: ["logist", "admin"],
    description: "Поиск водителей и машин в базе: по городу, кузову, грузоподъёмности и статусу (free — свободен, busy — в рейсе).",
    properties: {
      city: city("Город, где сейчас машина"),
      body,
      min_capacity: nullable("number", { description: "Минимальная грузоподъёмность, т" }),
      status: nullable("string", { enum: ["free", "busy", "any", null], description: "По умолчанию free" }),
      verified_only: nullable("boolean", { description: "Только с проверенными документами" }),
    },
  },
  match_drivers: {
    roles: ["logist", "admin"],
    description:
      "Подбор лучших машин под груз с оценкой 0–100 и причинами. Передай cargo_code существующего груза ИЛИ параметры маршрута " +
      "(from_city, to_city, weight, body) для груза, которого ещё нет в системе.",
    properties: {
      cargo_code: nullable("string", { description: "Код груза, например K-1042" }),
      from_city: city("Город загрузки"),
      to_city: city("Город выгрузки"),
      weight: nullable("number", { description: "Вес, т" }),
      body,
      only_free: nullable("boolean", { description: "Только свободные машины (по умолчанию true)" }),
    },
  },
  get_cargo: {
    roles: ["logist", "driver", "admin"],
    description: "Карточка груза по коду: статус рейса, где машина, история статусов, водитель, отклики.",
    properties: { cargo_code: { type: "string", description: "Код груза, например K-1041" } },
  },
  estimate_rate: {
    roles: ["logist", "driver", "admin"],
    description: "Оценка рыночной ставки рейса в тенге по истории завершённых рейсов на платформе и расстояния по дорогам.",
    properties: {
      from_city: { type: "string" },
      to_city: { type: "string" },
      weight: nullable("number", { description: "Вес, т (по умолчанию 20)" }),
      body,
    },
  },
  find_backhaul: {
    roles: ["logist", "driver", "admin"],
    description: "Обратная загрузка: открытые грузы из указанного города и городов в радиусе ~250 км, чтобы машина не ехала пустой.",
    properties: {
      city: { type: "string", description: "Город, где машина разгрузится" },
      body,
      max_weight: nullable("number", { description: "Грузоподъёмность машины, т" }),
    },
  },
  platform_stats: {
    roles: ["logist", "driver", "admin"],
    description: "Сводка: для логиста — рейсы, выручка, средняя ставка, время поиска машины, топ направлений; для водителя — его рейсы и заработок.",
    properties: { months: nullable("integer", { description: "За сколько месяцев, по умолчанию 1" }) },
  },
};

export function toolsForRole(role) {
  return Object.entries(DEFS)
    .filter(([, d]) => d.roles.includes(role))
    .map(([name, d]) => ({
      name,
      description: d.description,
      strict: true,
      input_schema: { type: "object", properties: d.properties, required: Object.keys(d.properties), additionalProperties: false },
    }));
}

const cargoCard = (c, extra = {}) => ({
  type: "cargo", code: c.code, from_city: c.from_city, to_city: c.to_city, load_date: c.load_date,
  weight: c.weight, body: c.body, price: c.price, status: c.status, status_label: STATUS_LABELS[c.status], ...extra,
});
const driverCard = (d, extra = {}) => ({
  type: "driver", id: d.id, name: d.name, phone: d.phone, city: d.city, status: d.status, verify: d.verify,
  rating: d.rating, trips: d.trips, vehicle_model: d.vehicle_model, body: d.body, capacity: d.capacity, ...extra,
});

async function nearbyCities(name, radiusKm = 250) {
  return Object.keys(CITIES).filter((c) => c === name || (roadDistanceKm(name, c) ?? 1e9) <= radiusKm);
}

/** Выполнить инструмент. Возвращает { result } для модели и { cards } для интерфейса. */
export async function runTool(name, rawInput, user) {
  const def = DEFS[name];
  if (!def || !def.roles.includes(user.role)) return { result: { error: `Инструмент ${name} недоступен для этой роли` }, cards: [] };
  const input = Object.fromEntries(Object.entries(rawInput ?? {}).filter(([, v]) => v !== null && v !== undefined));

  switch (name) {
    case "search_cargos": {
      const limit = Math.min(Number(input.limit) || 10, 25);
      const from = normalizeCity(input.from_city), to = normalizeCity(input.to_city);
      const params = [], where = [];
      if (from) { params.push(from); where.push(`c.from_city = $${params.length}`); }
      if (to) { params.push(to); where.push(`c.to_city = $${params.length}`); }
      if (input.body) { params.push(input.body); where.push(`c.body = $${params.length}`); }
      if (input.max_weight) { params.push(input.max_weight); where.push(`c.weight <= $${params.length}`); }
      if (user.role === "driver") where.push("c.status = 'open'");
      else {
        if (user.role === "logist") { params.push(user.id); where.push(`c.logist_id = $${params.length}`); }
        const st = input.status ?? "all";
        if (st === "active") where.push("c.status IN ('assigned','loading','in_transit')");
        else if (st !== "all") { params.push(st); where.push(`c.status = $${params.length}`); }
      }
      const rows = await all(
        `SELECT c.*, dv.name AS driver_name FROM cargos c LEFT JOIN users dv ON dv.id = c.driver_id
         ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY c.load_date DESC LIMIT 60`, params);
      let list = rows;
      if (user.role === "driver") {
        const me = await one("SELECT * FROM drivers WHERE user_id = $1", [user.id]);
        list = rows.map((c) => ({ ...c, match: scoreCargoForDriver(c, me) })).sort((a, b) => b.match.score - a.match.score);
      }
      list = list.slice(0, limit);
      return {
        result: {
          found: rows.length,
          cargos: list.map((c) => ({
            code: c.code, route: `${c.from_city} → ${c.to_city}`, load_date: c.load_date, weight_t: c.weight, body: c.body,
            price_kzt: c.price, distance_km: c.distance_km, status: STATUS_LABELS[c.status], kind: c.kind,
            ...(c.driver_name ? { driver: c.driver_name } : {}),
            ...(c.match ? { fit_score: c.match.score, fit_reasons: c.match.reasons } : {}),
          })),
        },
        cards: list.map((c) => cargoCard(c, c.match ? { score: c.match.score } : {})),
      };
    }

    case "find_drivers": {
      const rows = await findDrivers({
        city: normalizeCity(input.city), body: input.body, minCapacity: input.min_capacity,
        status: input.status ?? "free", verifiedOnly: input.verified_only, limit: 15,
      });
      return {
        result: { found: rows.length, drivers: rows.map((d) => ({ id: d.id, name: d.name, phone: d.phone, city: d.city, status: d.status, verify: d.verify, rating: d.rating, trips: d.trips, vehicle: `${d.vehicle_model ?? ""} ${d.body ?? ""} ${d.capacity ?? "?"} т`.trim() })) },
        cards: rows.map((d) => driverCard(d)),
      };
    }

    case "match_drivers": {
      let cargo;
      if (input.cargo_code) {
        cargo = await one("SELECT * FROM cargos WHERE code = $1", [String(input.cargo_code).toUpperCase()]);
        if (!cargo || (user.role === "logist" && cargo.logist_id !== user.id)) return { result: { error: `Груз ${input.cargo_code} не найден среди ваших` }, cards: [] };
      } else {
        const from = normalizeCity(input.from_city), to = normalizeCity(input.to_city);
        if (!from) return { result: { error: "Не указан или не распознан город загрузки" }, cards: [] };
        cargo = { from_city: from, to_city: to, weight: input.weight ?? 20, body: input.body ?? "Тент" };
      }
      const ranked = (await rankDriversForCargo(cargo, { limit: 6, onlyAvailable: input.only_free !== false }));
      return {
        result: {
          cargo: { code: cargo.code ?? null, route: `${cargo.from_city} → ${cargo.to_city ?? "?"}`, weight_t: cargo.weight, body: cargo.body },
          matches: ranked.map((d) => ({ id: d.id, name: d.name, phone: d.phone, score: d.score, reasons: d.reasons, vehicle: `${d.vehicle_model} · ${d.body} · ${d.capacity} т`, city: d.city, rating: d.rating })),
        },
        cards: ranked.map((d) => driverCard(d, { score: d.score, reasons: d.reasons })),
      };
    }

    case "get_cargo": {
      const code = String(input.cargo_code ?? "").toUpperCase().replace(/^К/, "K");
      const c = await one(
        `SELECT c.*, dv.name AS driver_name, dv.phone AS driver_phone, d.vehicle_model, d.plate, d.city AS driver_city
         FROM cargos c LEFT JOIN users dv ON dv.id = c.driver_id LEFT JOIN drivers d ON d.user_id = c.driver_id WHERE c.code = $1`, [code]);
      const allowed = c && (user.role === "admin" || (user.role === "logist" && c.logist_id === user.id) ||
        (user.role === "driver" && (c.status === "open" || c.driver_id === user.id)));
      if (!allowed) return { result: { error: `Груз ${code} не найден или нет доступа` }, cards: [] };
      const events = await all("SELECT status, city, note, created_at FROM trip_events WHERE cargo_id = $1 ORDER BY created_at", [c.id]);
      const offers = await one("SELECT COUNT(*) FILTER (WHERE status='pending' AND source='driver') AS pending FROM offers WHERE cargo_id = $1", [c.id]);
      const last = events.at(-1);
      const t = c.driver_id ? await trackSummary(c, { withPoints: false }) : null;
      const gps = t?.last ? {
        signal: t.signal === "live" ? "онлайн" : `нет сигнала ${t.last.age_min} мин`,
        near_city: t.last.nearest.km <= 15 ? t.last.nearest.name : `${t.last.nearest.name}, ${t.last.nearest.km} км`,
        speed_kmh: t.last.speed_kmh, traveled_km: t.traveled_km, remaining_km: t.remaining_km,
        progress_pct: t.progress != null ? Math.round(t.progress * 100) : null, eta: t.eta_at,
      } : null;
      return {
        result: {
          code: c.code, route: `${c.from_city} → ${c.to_city}`, status: STATUS_LABELS[c.status], load_date: c.load_date,
          weight_t: c.weight, body: c.body, price_kzt: c.price, distance_km: c.distance_km,
          driver: c.driver_name ? { name: c.driver_name, phone: user.role === "driver" ? undefined : c.driver_phone, vehicle: c.vehicle_model, plate: c.plate } : null,
          gps,
          last_known_city: last?.city ?? (c.status === "in_transit" ? c.driver_city : null),
          last_update: last ? { status: STATUS_LABELS[last.status] ?? "комментарий", city: last.city, note: last.note, at: last.created_at } : null,
          history: events.map((e) => ({ status: STATUS_LABELS[e.status] ?? "комментарий", city: e.city, note: e.note, at: e.created_at })),
          pending_offers: user.role === "driver" ? undefined : offers.pending,
        },
        cards: [cargoCard(c)],
      };
    }

    case "estimate_rate": {
      const est = await estimateRate({ fromCity: normalizeCity(input.from_city), toCity: normalizeCity(input.to_city), weight: input.weight ?? 20, body: input.body ?? "Тент" });
      return { result: est ?? { error: "Не удалось посчитать: один из городов не найден в справочнике" }, cards: [] };
    }

    case "find_backhaul": {
      const base = normalizeCity(input.city);
      if (!base) return { result: { error: `Город «${input.city}» не найден в справочнике` }, cards: [] };
      const near = await nearbyCities(base);
      const params = [near], where = ["c.status = 'open'", "c.from_city = ANY($1)"];
      if (input.body) { params.push(input.body); where.push(`c.body = $${params.length}`); }
      if (input.max_weight) { params.push(input.max_weight); where.push(`c.weight <= $${params.length}`); }
      const rows = await all(`SELECT c.* FROM cargos c WHERE ${where.join(" AND ")} ORDER BY c.load_date LIMIT 10`, params);
      return {
        result: {
          searched_cities: near, found: rows.length,
          cargos: rows.map((c) => ({ code: c.code, route: `${c.from_city} → ${c.to_city}`, km_from_unload: roadDistanceKm(base, c.from_city), load_date: c.load_date, weight_t: c.weight, body: c.body, price_kzt: c.price })),
        },
        cards: rows.map((c) => cargoCard(c)),
      };
    }

    case "platform_stats": {
      const months = Math.min(Math.max(Number(input.months) || 1, 1), 12);
      return { result: await analyticsSummary(user, months), cards: [] };
    }
  }
  return { result: { error: "Неизвестный инструмент" }, cards: [] };
}
