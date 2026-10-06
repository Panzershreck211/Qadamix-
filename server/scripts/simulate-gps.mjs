// Имитация движения фуры для демо: входит как водитель и шлёт GPS-точки к пункту назначения активного рейса.
// Запуск:  node scripts/simulate-gps.mjs [телефон водителя] [--interval=5] [--step=3]
//   по умолчанию водитель Санжар Оспанов (+77011000006), рейс в пути Караганда → Шымкент
//   --interval  секунд между точками (реального времени)
//   --step      км за один шаг
// Остановка: Ctrl+C. Скрипт не меняет статус рейса — «Доставлен» водитель отмечает сам.
const API = process.env.API || "http://localhost:4000/api";
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => a.slice(2).split("=")));
const phone = process.argv.slice(2).find((a) => !a.startsWith("--")) || "+77011000006";
const intervalSec = Number(args.interval) || 5;
const stepKm = Number(args.step) || 3;

// Координаты городов — те же, что на сервере
const CITIES = {
  "Астана": [51.1694, 71.4491], "Алматы": [43.2389, 76.8897], "Шымкент": [42.3417, 69.5901], "Караганда": [49.8047, 73.1094],
  "Актобе": [50.2839, 57.167], "Атырау": [47.0945, 51.9238], "Костанай": [53.2144, 63.6246], "Кокшетау": [53.2833, 69.3833],
  "Павлодар": [52.2873, 76.9674], "Усть-Каменогорск": [49.9483, 82.6279], "Тараз": [42.9, 71.3667], "Актау": [43.65, 51.1667],
  "Семей": [50.4111, 80.2275], "Туркестан": [43.2973, 68.2518], "Кызылорда": [44.8488, 65.4823], "Хоргос": [44.2167, 80.4167],
  "Петропавловск": [54.8667, 69.15], "Уральск": [51.2333, 51.3667], "Талдыкорган": [45.0167, 78.3667], "Жезказган": [47.7833, 67.7667],
  "Экибастуз": [51.7298, 75.3266], "Ташкент": [41.2995, 69.2401], "Бишкек": [42.8746, 74.5698], "Москва": [55.7558, 37.6173],
  "Екатеринбург": [56.8389, 60.6057], "Новосибирск": [55.0084, 82.9357], "Омск": [54.9885, 73.3242], "Урумчи": [43.8256, 87.6168],
};

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const rad = (d) => (d * Math.PI) / 180;
function distKm([a, b], [c, d]) {
  const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}
function bearing([a, b], [c, d]) {
  const y = Math.sin(rad(d - b)) * Math.cos(rad(c));
  const x = Math.cos(rad(a)) * Math.sin(rad(c)) - Math.sin(rad(a)) * Math.cos(rad(c)) * Math.cos(rad(d - b));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

const { devCode } = await call("POST", "/auth/request-code", null, { phone });
const { token, user } = await call("POST", "/auth/verify", null, { phone, code: devCode });
const trips = await call("GET", "/my/trips", token);
const trip = trips.find((t) => ["assigned", "loading", "in_transit"].includes(t.status));
if (!trip) { console.error(`У водителя ${user.name} нет активного рейса`); process.exit(1); }

const me = await call("GET", "/auth/me", token);
const dest = CITIES[trip.to_city];
let pos = me.driver.last_lat != null ? [me.driver.last_lat, me.driver.last_lon] : CITIES[trip.from_city];
console.log(`${user.name}: рейс ${trip.code} ${trip.from_city} → ${trip.to_city}, до цели ~${Math.round(distKm(pos, dest))} км по прямой.`);
console.log(`Каждые ${intervalSec} с — шаг ${stepKm} км. Ctrl+C — остановить.`);

async function tick() {
  const left = distKm(pos, dest);
  if (left < 1) { console.log("Прибыли в пункт назначения. Отметьте «Доставлен» в приложении водителя."); process.exit(0); }
  const t = Math.min(1, stepKm / left);
  const next = [pos[0] + (dest[0] - pos[0]) * t + (Math.random() - 0.5) * 0.004, pos[1] + (dest[1] - pos[1]) * t + (Math.random() - 0.5) * 0.004];
  const point = { lat: next[0], lon: next[1], speed: Math.round(65 + Math.random() * 20), heading: Math.round(bearing(pos, next)), accuracy: 8, recordedAt: new Date().toISOString() };
  const r = await call("POST", "/me/positions", token, { points: [point] });
  pos = next;
  console.log(`${new Date().toLocaleTimeString("ru-RU")}  ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}  ${point.speed} км/ч  рядом: ${r.nearestCity.name} (${r.nearestCity.km} км)  до цели ~${Math.round(left)} км`);
}

await tick();
setInterval(() => tick().catch((e) => console.error("Ошибка отправки:", e.message)), intervalSec * 1000);
