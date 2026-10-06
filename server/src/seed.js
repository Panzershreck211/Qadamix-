// Демо-данные: пользователи, машины, полгода истории рейсов и текущие грузы.
// Запуск: npm run seed  (флаг --reset очищает базу перед заполнением)
import { pool, migrate, tx, query, one } from "./db.js";
import { roadDistanceKm, CITIES, straightKm } from "./cities.js";
import { bodyFits } from "./matching.js";

// Детерминированный генератор, чтобы демо-данные были одинаковыми при каждом запуске
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (a, b) => a + rnd() * (b - a);

const LOGISTS = [
  { phone: "+77010000001", name: "Айгерим Сапарова", company: "ТОО «Qadam Logistics»" },
  { phone: "+77010000002", name: "Данияр Ермеков", company: "ТОО «Ак Жол Логистик»" },
];
const ADMIN = { phone: "+77010000000", name: "Администратор QADAMIX" };

const DRIVERS = [
  ["+77011000001", "Иван Петров", "Астана", "MAN TGX", "Тент", 20, 86, "verified", 4.9, 118, "Казахстан, Казахстан → Россия", "123 ABC 01"],
  ["+77011000002", "Дмитрий Ким", "Караганда", "Volvo FH", "Тент", 22, 90, "verified", 4.7, 74, "Казахстан", "456 KZA 09"],
  ["+77011000003", "Тимур Байжанов", "Астана", "Kenworth T680", "Низкорамный трал", 40, null, "verified", 5.0, 64, "Казахстан, Казахстан → Узбекистан", "777 TRL 01"],
  ["+77011000004", "Айдос Жумабек", "Павлодар", "Renault Magnum", "Тент", 20, 82, "verified", 4.8, 88, "Казахстан", "314 PVL 14"],
  ["+77011000005", "Ерлан Ахметов", "Астана", "Scania R500", "Рефрижератор", 20, 76, "verified", 4.8, 96, "Казахстан, Казахстан → Китай", "505 REF 01"],
  ["+77011000006", "Санжар Оспанов", "Шымкент", "Mercedes Actros", "Тент", 20, 86, "verified", 4.9, 162, "Казахстан, Казахстан → Узбекистан", "162 SHM 13"],
  ["+77011000007", "Марат Сейтжанов", "Актобе", "DAF XF", "Борт", 20, 60, "none", 4.4, 33, "Казахстан", "033 AKT 04"],
  ["+77011000008", "Асхат Нурланов", "Алматы", "Isuzu Forward", "Изотерм", 10, 40, "pending", 4.6, 51, "Казахстан", "051 ALA 02"],
  ["+77011000009", "Нурлан Абдрахманов", "Алматы", "MAN TGS", "Рефрижератор", 20, 80, "verified", 4.7, 102, "Казахстан, Казахстан → Узбекистан", "909 ALA 02"],
  ["+77011000010", "Серик Тулегенов", "Костанай", "КамАЗ 6520", "Самосвал", 25, 20, "verified", 4.5, 140, "Казахстан", "610 KST 10"],
  ["+77011000011", "Бауыржан Касымов", "Атырау", "Volvo FH", "Борт", 22, 70, "verified", 4.8, 79, "Казахстан, Казахстан → Россия", "211 ATR 06"],
  ["+77011000012", "Олжас Мухамедов", "Усть-Каменогорск", "Scania R450", "Тент", 20, 86, "verified", 4.6, 58, "Казахстан, Казахстан → Китай", "450 UKG 16"],
];

// Направления истории: [откуда, куда, кузов, тоннаж, вес вероятности, что везли]
const ROUTES = [
  ["Астана", "Алматы", "Тент", [18, 20], 9, "стройматериалы"],
  ["Караганда", "Шымкент", "Тент", [16, 20], 6, "металлопрокат"],
  ["Алматы", "Актобе", "Тент", [10, 20], 4, "оборудование"],
  ["Хоргос", "Астана", "Тент", [18, 20], 5, "товары из Китая"],
  ["Атырау", "Актау", "Борт", [18, 22], 4, "трубы"],
  ["Костанай", "Астана", "Самосвал", [22, 25], 3, "зерно"],
  ["Алматы", "Астана", "Рефрижератор", [12, 20], 5, "фрукты"],
  ["Павлодар", "Астана", "Тент", [15, 20], 3, "бытовая химия"],
  ["Шымкент", "Алматы", "Тент", [12, 20], 4, "текстиль"],
  ["Алматы", "Ташкент", "Рефрижератор", [10, 18], 2, "молочная продукция"],
  ["Астана", "Москва", "Тент", [18, 20], 2, "металлоконструкции"],
  ["Астана", "Караганда", "Низкорамный трал", [25, 38], 1, "спецтехника"],
  ["Усть-Каменогорск", "Астана", "Тент", [15, 20], 2, "цветной металл"],
  ["Алматы", "Караганда", "Изотерм", [6, 10], 2, "кондитерские изделия"],
];
const PER_KM = { "Рефрижератор": 300, "Изотерм": 280, "Низкорамный трал": 420, "Самосвал": 260 };
const REVIEW_TEXTS = [
  "Доставил вовремя, на связи весь рейс.", "Аккуратно, документы привёз сразу.", "Всё отлично, будем работать ещё.",
  "Небольшая задержка на погрузке, в остальном хорошо.", "Груз в сохранности, рекомендую.", "Температурный режим соблюдён.",
];

function weightedRoute() {
  const total = ROUTES.reduce((s, r) => s + r[4], 0);
  let x = rnd() * total;
  for (const r of ROUTES) { if ((x -= r[4]) <= 0) return r; }
  return ROUTES[0];
}
const priceFor = (from, to, body, weight) => {
  const km = roadDistanceKm(from, to);
  const perKm = (PER_KM[body] ?? 240) * between(0.9, 1.12);
  const wk = weight <= 10 ? 0.75 : weight > 20 ? 1.12 : 1;
  return { km, price: Math.round((km * perKm * wk * (km < 300 ? 1.25 : 1)) / 1000) * 1000 };
};
const isoDate = (d) => d.toISOString().slice(0, 10);

// Трек вдоль ломаной через города: равномерно по расстоянию, с шумом ±1 км и остановками на отдых
function trackAlong(cityNames, n) {
  const pts = cityNames.map((c) => CITIES[c]);
  const seg = pts.slice(1).map((p, i) => straightKm(pts[i], p));
  const total = seg.reduce((a, b) => a + b, 0);
  const out = [];
  for (let k = 0; k < n; k++) {
    let d = (total * k) / (n - 1), i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const t = seg[i] ? d / seg[i] : 0;
    const lat = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t + (rnd() - 0.5) * 0.015;
    const lon = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t + (rnd() - 0.5) * 0.015;
    out.push([lat, lon]);
  }
  return out;
}

async function seedGps(c, { sanzhar, nurlan, f, g, drivers, ago, offlineId }) {
  // Санжар: Караганда → Жезказган → Кызылорда за ~44 ч, едет днём, ночью стоит
  const path = trackAlong(["Караганда", "Жезказган", "Кызылорда"], 260);
  const startMin = 60 * 44, endMin = 4;
  const rest = (i) => (i > 95 && i < 120) || (i > 205 && i < 228); // две ночные стоянки
  let tMin = startMin;
  const moving = path.filter((_, i) => !rest(i)).length;
  const stepMin = (startMin - endMin - 2 * 9 * 60) / moving; // 2 ночи по ~9 ч
  let hold = null; // точка, где водитель встал на отдых
  for (let i = 0; i < path.length; i++) {
    hold = rest(i) ? hold ?? path[i] : null;
    const [lat, lon] = hold ?? path[i];
    const speed = rest(i) ? 0 : Math.round(between(62, 88));
    await query("INSERT INTO positions (driver_id, cargo_id, lat, lon, speed_kmh, heading, accuracy_m, recorded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [sanzhar.id, f.id, lat, lon, speed, 225, Math.round(between(5, 20)), ago(tMin)], c);
    tMin -= rest(i) ? (9 * 60) / 24 : stepMin;
  }
  const last = path.at(-1);
  await query("UPDATE drivers SET last_lat = $2, last_lon = $3, last_speed_kmh = 74, last_position_at = $4, gps_enabled = true WHERE user_id = $1", [sanzhar.id, last[0], last[1], ago(endMin)], c);

  // Нурлан стоит на загрузке в Алматы
  const [alat, alon] = CITIES["Алматы"];
  for (let k = 0; k < 6; k++) {
    await query("INSERT INTO positions (driver_id, cargo_id, lat, lon, speed_kmh, accuracy_m, recorded_at) VALUES ($1,$2,$3,$4,0,10,$5)",
      [nurlan.id, g.id, alat + 0.021 + k * 0.0001, alon - 0.035, ago(50 - k * 9)], c);
  }
  await query("UPDATE drivers SET last_lat = $2, last_lon = $3, last_speed_kmh = 0, last_position_at = $4, gps_enabled = true WHERE user_id = $1", [nurlan.id, alat + 0.0215, alon - 0.035, ago(5)], c);

  // Остальные — последняя точка в своём городе
  for (const d of drivers) {
    if ([sanzhar.id, nurlan.id, offlineId].includes(d.id)) continue;
    const [lat, lon] = CITIES[d.city];
    await query("UPDATE drivers SET last_lat = $2, last_lon = $3, last_speed_kmh = 0, last_position_at = $4, gps_enabled = true WHERE user_id = $1",
      [d.id, lat + (rnd() - 0.5) * 0.06, lon + (rnd() - 0.5) * 0.06, ago(Math.round(between(5, 240)))], c);
  }
}

async function reset() {
  await query(`TRUNCATE positions, chat_sessions, notifications, reviews, trip_events, offers, cargos, drivers, otp_codes, users RESTART IDENTITY CASCADE`);
  await query("ALTER SEQUENCE cargo_code_seq RESTART WITH 1001");
}

async function main() {
  await migrate();
  const hasData = await one("SELECT COUNT(*) AS n FROM users");
  if (hasData.n > 0 && !process.argv.includes("--reset")) {
    console.log("В базе уже есть данные. Для пересоздания: npm run seed (с флагом --reset)");
    return;
  }
  await reset();

  await tx(async (c) => {
    await query("INSERT INTO users (role, phone, name) VALUES ('admin', $1, $2)", [ADMIN.phone, ADMIN.name], c);
    const logistIds = [];
    for (const l of LOGISTS) {
      logistIds.push((await one("INSERT INTO users (role, phone, name, company) VALUES ('logist', $1, $2, $3) RETURNING id", [l.phone, l.name, l.company], c)).id);
    }
    const drivers = [];
    for (const [phone, name, city, model, body, capacity, volume, verify, rating, trips, directions, plate] of DRIVERS) {
      const id = (await one("INSERT INTO users (role, phone, name, created_at) VALUES ('driver', $1, $2, now() - interval '200 days') RETURNING id", [phone, name], c)).id;
      await query(
        `INSERT INTO drivers (user_id, city, status, verify, rating, trips, vehicle_model, body, capacity, volume, plate, directions)
         VALUES ($1,$2,'free',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [id, city, verify, rating, trips, model, body, capacity, volume, plate, directions], c,
      );
      drivers.push({ id, name, city, body, capacity });
    }
    const byName = Object.fromEntries(drivers.map((d) => [d.name, d]));

    // ---- История: завершённые рейсы за ~6 месяцев с ростом объёма ----
    const perMonth = [[12, 5], [15, 6], [18, 7], [21, 7], [24, 9], [14, 5]]; // [логист 1, логист 2], последний — текущий месяц
    for (let m = 0; m < perMonth.length; m++) {
      const monthsAgo = perMonth.length - 1 - m;
      for (let li = 0; li < 2; li++) {
        for (let k = 0; k < perMonth[m][li]; k++) {
          const [from, to, body, [wMin, wMax], , kind] = weightedRoute();
          const weight = Math.round(between(wMin, wMax));
          const candidates = drivers.filter((d) => bodyFits(body, d.body) === "exact" && d.capacity >= weight);
          const driver = pick(candidates.length ? candidates : drivers);
          const { km, price } = priceFor(from, to, body, weight);
          // Дата доставки внутри календарного месяца; в текущем месяце — только прошедшие дни
          const now = new Date();
          const dayInMonth = monthsAgo === 0 ? 1 + Math.floor(rnd() * Math.max(now.getDate() - 1, 1)) : 1 + Math.floor(rnd() * 28);
          const delivered = new Date(now.getFullYear(), now.getMonth() - monthsAgo, dayInMonth, 12 + Math.floor(rnd() * 8), Math.floor(rnd() * 60));
          if (delivered > now) delivered.setTime(now.getTime() - 3600_000);
          const transitDays = Math.max(1, Math.round(km / 650));
          const loadDate = new Date(delivered); loadDate.setDate(loadDate.getDate() - transitDays);
          const created = new Date(loadDate); created.setDate(created.getDate() - Math.ceil(between(0, 2))); created.setHours(9, Math.floor(rnd() * 60));
          const assigned = new Date(created.getTime() + between(6, 75) * 60000);
          const cargo = await one(
            `INSERT INTO cargos (logist_id, from_city, to_city, load_date, weight, body, kind, price, distance_km, status, driver_id, created_at, assigned_at, delivered_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'delivered',$10,$11,$12,$13) RETURNING id`,
            [logistIds[li], from, to, isoDate(loadDate), weight, body, kind, price, km, driver.id, created, assigned, delivered], c,
          );
          const offersN = 1 + Math.floor(rnd() * 4);
          await query("INSERT INTO offers (cargo_id, driver_id, price, status, created_at) VALUES ($1,$2,$3,'accepted',$4)", [cargo.id, driver.id, price, assigned], c);
          for (const other of drivers.filter((d) => d.id !== driver.id && bodyFits(body, d.body) !== "no").slice(0, offersN - 1)) {
            await query("INSERT INTO offers (cargo_id, driver_id, price, status, created_at) VALUES ($1,$2,$3,'rejected',$4)", [cargo.id, other.id, Math.round(price * between(0.97, 1.1) / 1000) * 1000, assigned], c);
          }
          const loading = new Date(loadDate); loading.setHours(9);
          const transit = new Date(loadDate); transit.setHours(14);
          await query(
            `INSERT INTO trip_events (cargo_id, author_id, status, city, created_at) VALUES
             ($1,$2,'assigned',NULL,$4), ($1,$3,'loading',$5,$6), ($1,$3,'in_transit',$5,$7), ($1,$3,'delivered',$8,$9)`,
            [cargo.id, logistIds[li], driver.id, assigned, from, loading, transit, to, delivered], c,
          );
          if (rnd() < 0.7) {
            const rating = rnd() < 0.8 ? 5 : 4;
            await query("INSERT INTO reviews (cargo_id, logist_id, driver_id, rating, comment, created_at) VALUES ($1,$2,$3,$4,$5,$6)",
              [cargo.id, logistIds[li], driver.id, rating, pick(REVIEW_TEXTS), delivered], c);
          }
        }
      }
    }
    await query(`UPDATE drivers d SET trips = d.trips + (SELECT COUNT(*) FROM cargos c WHERE c.driver_id = d.user_id AND c.status = 'delivered')`, [], c);

    // ---- Текущие грузы ----
    const L1 = logistIds[0], L2 = logistIds[1];
    const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDate(d); };
    const ago = (min) => new Date(Date.now() - min * 60000);
    const addCargo = async (logist, from, to, loadIn, weight, body, kind, price, extra = {}) => {
      const km = roadDistanceKm(from, to);
      return one(
        `INSERT INTO cargos (logist_id, from_city, to_city, load_date, weight, body, kind, price, distance_km, notes, status, driver_id, created_at, assigned_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id, code`,
        [logist, from, to, day(loadIn), weight, body, kind, price, km, extra.notes ?? null, extra.status ?? "open", extra.driver ?? null, extra.created ?? ago(90), extra.assigned ?? null], c,
      );
    };
    const offer = (cargoId, driver, price, comment, source = "driver", minutesAgo = 30) =>
      query("INSERT INTO offers (cargo_id, driver_id, price, comment, source, created_at) VALUES ($1,$2,$3,$4,$5,$6)", [cargoId, driver.id, price, comment, source, ago(minutesAgo)], c);

    const a = await addCargo(L1, "Астана", "Алматы", 1, 20, "Тент", "стройматериалы", 295000, { notes: "Загрузка с 9:00, нужны ремни, 10 шт", created: ago(55) });
    await offer(a.id, byName["Иван Петров"], 295000, "Могу встать на загрузку завтра в 9:00", "driver", 40);
    await offer(a.id, byName["Дмитрий Ким"], 285000, "Еду из Караганды, буду к утру", "driver", 25);
    await offer(a.id, byName["Айдос Жумабек"], 295000, null, "invite", 20);

    const b = await addCargo(L1, "Атырау", "Актау", 2, 22, "Борт", "трубы", 260000, { created: ago(180) });
    await offer(b.id, byName["Бауыржан Касымов"], 255000, "Борт 22 т, есть коники", "driver", 120);

    await addCargo(L1, "Костанай", "Астана", 1, 25, "Самосвал", "зерно", 230000, { created: ago(30) });
    await addCargo(L1, "Алматы", "Ташкент", 3, 18, "Рефрижератор", "молочная продукция", 520000, { notes: "Режим +2…+6 °C, CMR оформляем мы", created: ago(240) });
    await addCargo(L1, "Павлодар", "Семей", 2, 5, "Изотерм", "продукты питания", 120000, { created: ago(15) });

    const sanzhar = byName["Санжар Оспанов"], nurlan = byName["Нурлан Абдрахманов"];
    const f = await addCargo(L1, "Караганда", "Шымкент", -2, 18, "Тент", "металлопрокат", 340000, { status: "in_transit", driver: sanzhar.id, created: ago(60 * 60), assigned: ago(60 * 59) });
    await query("INSERT INTO offers (cargo_id, driver_id, price, status, created_at) VALUES ($1,$2,340000,'accepted',$3)", [f.id, sanzhar.id, ago(60 * 59)], c);
    await query(
      `INSERT INTO trip_events (cargo_id, author_id, status, city, note, created_at) VALUES
       ($1,$2,'assigned',NULL,'Ставка 340 000 ₸',$4), ($1,$3,'loading','Караганда',NULL,$5), ($1,$3,'in_transit','Караганда',NULL,$6),
       ($1,$3,'note','Жезказган','Заправка, всё по графику',$7), ($1,$3,'note','Кызылорда','Едем, прибытие завтра к обеду',$8)`,
      [f.id, L1, sanzhar.id, ago(60 * 59), ago(60 * 48), ago(60 * 44), ago(60 * 26), ago(60 * 3)], c,
    );
    await query("UPDATE drivers SET status = 'busy', city = 'Кызылорда' WHERE user_id = $1", [sanzhar.id], c);

    const g = await addCargo(L1, "Алматы", "Астана", 0, 18, "Рефрижератор", "фрукты", 410000, { status: "loading", driver: nurlan.id, created: ago(60 * 20), assigned: ago(60 * 19), notes: "Режим +4 °C" });
    await query("INSERT INTO offers (cargo_id, driver_id, price, status, created_at) VALUES ($1,$2,410000,'accepted',$3)", [g.id, nurlan.id, ago(60 * 19)], c);
    await query(
      `INSERT INTO trip_events (cargo_id, author_id, status, city, created_at) VALUES ($1,$2,'assigned',NULL,$4), ($1,$3,'loading','Алматы',$5)`,
      [g.id, L1, nurlan.id, ago(60 * 19), ago(50)], c,
    );
    await query("UPDATE drivers SET status = 'busy' WHERE user_id = $1", [nurlan.id], c);

    await addCargo(L2, "Шымкент", "Алматы", 1, 20, "Тент", "текстиль", 215000, { created: ago(70) });
    await addCargo(L2, "Актобе", "Астана", 2, 18, "Тент", "запчасти", 330000, { created: ago(130) });
    await addCargo(L2, "Алматы", "Караганда", 1, 8, "Изотерм", "кондитерские изделия", 260000, { created: ago(45) });
    await query("UPDATE drivers SET status = 'offline' WHERE user_id = $1", [byName["Марат Сейтжанов"].id], c);

    // ---- GPS ----
    await seedGps(c, { sanzhar, nurlan, f, g, drivers, ago, offlineId: byName["Марат Сейтжанов"].id });

    // ---- Уведомления ----
    const n = (user, title, body, link, minutes, read = false) =>
      query("INSERT INTO notifications (user_id, title, body, link, read, created_at) VALUES ($1,$2,$3,$4,$5,$6)", [user, title, body, link, read, ago(minutes)], c);
    await n(L1, "Новый отклик", `Иван Петров готов везти ${a.code} за 295 000 ₸`, `/cargos/${a.code}`, 40);
    await n(L1, "Новый отклик", `Дмитрий Ким готов везти ${a.code} за 285 000 ₸`, `/cargos/${a.code}`, 25);
    await n(L1, `${f.code}: Комментарий водителя`, "Кызылорда · Едем, прибытие завтра к обеду", `/cargos/${f.code}`, 180);
    await n(L1, `${g.code}: На загрузке`, "Алматы", `/cargos/${g.code}`, 50, true);
    await n(byName["Айдос Жумабек"].id, "Вам предложили рейс", `Астана → Алматы, 20 т, 295 000 ₸. Откликнитесь, если готовы`, `/cargo/${a.code}`, 20);
    await n(byName["Иван Петров"].id, "Новый груз рядом", `Астана → Алматы, 20 т, Тент, 295 000 ₸`, `/cargo/${a.code}`, 55, true);
  });

  const stats = await one(`SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM cargos) AS cargos,
    (SELECT COUNT(*) FROM cargos WHERE status='delivered') AS delivered, (SELECT COUNT(*) FROM reviews) AS reviews`);
  console.log(`Готово: ${stats.users} пользователей, ${stats.cargos} грузов (${stats.delivered} доставлено), ${stats.reviews} отзывов.`);
  console.log("Вход (код придёт в ответе API в режиме разработки): логист +7 701 000 00 01, водитель +7 701 100 00 01, админ +7 701 000 00 00");
}

try { await main(); } finally { await pool.end(); }
