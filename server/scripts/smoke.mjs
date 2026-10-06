// Сквозная проверка API: вход логиста и водителя, подбор, отклик, рейс, ставка, разбор текста, ассистент.
// Запуск: node scripts/smoke.mjs  (сервер должен работать, база — заполнена `npm run seed`)
const API = process.env.API || "http://localhost:4000/api";
let failed = 0;

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
const get = (p, t) => call("GET", p, t);
const post = (p, t, b) => call("POST", p, t, b);

function check(name, cond, detail = "") {
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failed++;
}

async function login(phone) {
  const { data } = await post("/auth/request-code", null, { phone });
  const r = await post("/auth/verify", null, { phone, code: data.devCode });
  return r.data.token;
}

const L = await login("+7 701 000 00 01");
const D = await login("87011000002"); // Дмитрий Ким
check("вход логиста и водителя", L && D);

const active = (await get("/cargos?status=active", L)).data;
check("логист видит активные грузы", active.length >= 5, `${active.length} шт.`);
const open = active.find((c) => c.from_city === "Астана" && c.status === "open");

const matches = (await get(`/cargos/${open.code}/matches?limit=4`, L)).data;
check("подбор машин с причинами", matches[0]?.reasons?.length > 0, `${matches[0].name} ${matches[0].score}%: ${matches[0].reasons.join(", ")}`);

const market = (await get("/market", D)).data;
check("лента водителя отсортирована по соответствию", market.length > 0 && market[0].match.score >= market.at(-1).match.score, `${market[0].code} ${market[0].match.score}%`);

const offers = (await get(`/cargos/${open.code}/offers`, L)).data;
const dima = offers.find((o) => o.driver_name === "Дмитрий Ким");
const acc = await post(`/offers/${dima.id}/accept`, L);
check("логист принимает отклик", acc.data.status === "assigned", `${acc.data.code} → ${acc.data.driver_name}`);
const again = await post(`/offers/${offers.find((o) => o.driver_name === "Иван Петров").id}/accept`, L);
check("второй отклик принять нельзя", again.status === 409, again.data.error);

for (const status of ["loading", "in_transit"]) {
  const r = await post(`/cargos/${open.code}/events`, D, { status, city: "Астана" });
  check(`водитель: ${status}`, r.data.status === status);
}
const back = await post(`/cargos/${open.code}/events`, D, { status: "loading" });
check("статус нельзя откатить назад", back.status === 409, back.data.error);
const deliv = await post(`/cargos/${open.code}/events`, D, { status: "delivered", city: "Алматы" });
check("доставка", deliv.data.status === "delivered");
check("отзыв после доставки", (await post(`/cargos/${open.code}/review`, L, { rating: 5, comment: "Отлично" })).data.ok);

const rate = (await get(`/rate-estimate?from=${encodeURIComponent("Астана")}&to=${encodeURIComponent("Шымкент")}&weight=18&body=${encodeURIComponent("Тент")}`, L)).data;
check("оценка ставки", rate.market > 0, `${rate.distanceKm} км, ${rate.market} ₸ (${rate.basedOn})`);

const parsed = (await post("/cargos/parse", L, { text: "Нужна фура тент 20т Астана-Алматы на завтра 300к" })).data;
check("разбор текста заявки", parsed.fromCity === "Астана" && parsed.toCity === "Алматы" && parsed.weight === 20 && parsed.price === 300000, JSON.stringify(parsed));

const a = (await get("/analytics?months=6", L)).data;
check("аналитика по месяцам", a.monthly.length === 6 && a.monthly.every((m) => m.trips > 0), a.monthly.map((m) => `${m.month}:${m.trips}`).join(" "));

const bad = await post("/cargos", L, { fromCity: "Ташкентище", toCity: "Алматы", loadDate: "2026-10-10", weight: 0, body: "Тент", price: 100 });
check("валидация груза", bad.status === 400, bad.data.error);
check("роль: логист не видит ленту водителя", (await get("/market", L)).status === 403);

// GPS
const S = await login("+7 701 100 00 06"); // Санжар, рейс в пути
const L2 = await login("+7 701 000 00 02"); // другой логист
const inTransit = active.find((c) => c.status === "in_transit");
const before = (await get(`/cargos/${inTransit.code}/track`, L)).data;
check("трек рейса из демо-данных", before.points > 100 && before.last && before.progress > 0, `${before.points} точек, пройдено ${before.traveled_km} км, осталось ${before.remaining_km} км, ${Math.round(before.progress * 100)}%`);
const ts = new Date().toISOString();
const pts = { points: [{ lat: 44.80, lon: 65.62, speed: 78, heading: 120, accuracy: 6, recordedAt: ts }] };
const sent = await post("/me/positions", S, pts);
check("водитель отправляет GPS", sent.data.accepted === 1 && sent.data.cargo === inTransit.code, `ближайший город: ${sent.data.nearestCity.name}, ${sent.data.nearestCity.km} км`);
check("повторная пачка не дублирует точки", (await post("/me/positions", S, pts)).data.accepted === 0);
const after = (await get(`/cargos/${inTransit.code}/track`, L)).data;
check("логист видит новую точку и ETA", after.signal === "live" && after.last.lat === 44.8 && after.eta_at, `ETA ${after.eta_at}`);
check("чужой логист не видит трек", (await get(`/cargos/${inTransit.code}/track`, L2)).status === 403);
const fleet = (await get("/fleet", L)).data;
const sanzharOnMap = fleet.find((d) => d.trip?.code === inTransit.code);
const strangerExact = (await get("/fleet", L2)).data.find((d) => d.name === sanzharOnMap?.name);
check("карта парка: точные координаты только по своим рейсам", sanzharOnMap?.exact && strangerExact && !strangerExact.exact, `${fleet.length} машин на карте`);
await post(`/cargos/${inTransit.code}/events`, S, { status: "note", note: "Проверка GPS" });
const lastEvent = (await get(`/cargos/${inTransit.code}`, L)).data.events.at(-1);
check("город в статусе подставляется по GPS", lastEvent.city === "Кызылорда", lastEvent.city ?? "не подставлен");
const old = await post("/me/positions", S, { points: [{ lat: 44.8, lon: 65.62, recordedAt: "2020-01-01T00:00:00Z" }] });
check("слишком старые точки отбрасываются", old.data.accepted === 0);

// Ассистент
const ask =async (token, message, conversationId) => (await post("/assistant", token, { message, conversationId })).data;
const q1 = await ask(L, "Найди машину на завтра из Астаны в Алматы на 20 тонн");
check("ассистент: подбор машины", q1.cards?.some((c) => c.type === "driver"), q1.reply.split("\n")[0]);
const q2 = await ask(L, "привет", q1.conversationId);
check("ассистент: непонятный запрос не превращается в подбор", !q2.cards?.length, q2.reply.split("\n")[0]);
const q3 = await ask(L, "Нужен реф 10 т Алматы — Ташкент");
check("ассистент: международный маршрут", q3.reply.includes("Ташкент"), q3.reply.split("\n")[0]);
const q4 = await ask(D, "обратный груз из Актобе");
check("ассистент водителя: обратная загрузка", q4.cards?.length > 0, q4.reply.split("\n")[0]);
const q5 = await ask(L, "Где сейчас " + active.find((c) => c.status === "in_transit").code + "?");
check("ассистент: статус рейса", /В пути|в пути/.test(q5.reply), q5.reply.replace(/\n/g, " | "));

console.log(failed ? `\n${failed} проверок не прошли` : "\nВсе проверки прошли");
process.exit(failed ? 1 : 0);
