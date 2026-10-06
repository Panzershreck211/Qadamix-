// Режим без LLM: распознаём намерение по ключевым словам и вызываем те же инструменты, что и Claude.
// Главное правило — на непонятный запрос не выдумывать ответ, а честно сказать, что умеем.
import { one } from "../db.js";
import { runTool } from "./tools.js";
import { parseWithRules } from "./parse.js";
import { roadDistanceKm } from "../cities.js";

const money = (n) => `${Math.round(n).toLocaleString("ru-RU")} ₸`;
const num = (n) => Math.round(n).toLocaleString("ru-RU");
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? few : many;
}
const cargosN = (n) => `${n} ${plural(n, "груз", "груза", "грузов")}`;

const HELP = {
  logist: [
    "Я понимаю запросы вроде:",
    "• «Найди машину Астана — Алматы, 20 т, тент»",
    "• «Свободные рефы в Алматы»",
    "• «Где сейчас {CODE}?» или «Подбери машину под {CODE}»",
    "• «Сколько стоит рейс Караганда — Шымкент, 18 т?»",
    "• «Обратный груз из Актобе»",
    "• «Мои грузы в пути», «Статистика за месяц»",
  ],
  driver: [
    "Я понимаю запросы вроде:",
    "• «Грузы из Алматы» или «Груз Астана — Караганда»",
    "• «Обратный груз из Шымкента»",
    "• «Сколько стоит рейс Астана — Алматы, 20 т?»",
    "• «Статус {CODE}», «Мой заработок за месяц»",
  ],
};
HELP.admin = HELP.logist;

const has = (s, re) => re.test(s);

export async function answerWithRules(user, text) {
  const s = text.toLowerCase().replace(/ё/g, "е");
  const p = parseWithRules(text);
  const code = text.match(/\b[KК]-?\s?(\d{3,6})\b/i);
  const isLogist = user.role !== "driver";

  // 1. Конкретный груз по коду
  if (code) {
    const cargoCode = `K-${code[1]}`;
    if (isLogist && has(s, /подбер|найди|машин|кто повез|водител/)) return matchReply(user, { cargo_code: cargoCode });
    const { result, cards } = await runTool("get_cargo", { cargo_code: cargoCode }, user);
    if (result.error) return { reply: result.error, cards: [] };
    const lines = [`${result.code}, ${result.route}: ${result.status}.`];
    if (result.gps) {
      const g = result.gps;
      const eta = g.eta ? new Date(g.eta).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Almaty" }) : null;
      lines.push(`GPS (${g.signal}): ${g.near_city}${g.speed_kmh ? `, ${Math.round(g.speed_kmh)} км/ч` : ""}. Пройдено ${g.traveled_km} км, осталось ~${g.remaining_km} км${g.progress_pct != null ? ` (${g.progress_pct}%)` : ""}${eta ? `, прибытие ~${eta}` : ""}.`);
    }
    if (result.last_update) lines.push(`Последнее обновление: ${result.last_update.status}${result.last_update.city ? `, ${result.last_update.city}` : ""}${result.last_update.note ? ` (${result.last_update.note})` : ""}.`);
    if (result.driver) lines.push(`Водитель: ${result.driver.name}${result.driver.vehicle ? `, ${result.driver.vehicle}` : ""}${result.driver.phone ? `, ${result.driver.phone}` : ""}.`);
    if (result.pending_offers) lines.push(`Откликов ждут решения: ${result.pending_offers}.`);
    return { reply: lines.join("\n"), cards };
  }

  // 2. Обратная загрузка
  if (has(s, /обратн/)) {
    let city = p.fromCity ?? p.toCity;
    if (!city && !isLogist) city = (await one("SELECT city FROM drivers WHERE user_id = $1", [user.id]))?.city;
    if (!city) return { reply: "Из какого города нужен обратный груз? Например: «Обратный груз из Актобе».", cards: [] };
    const { result, cards } = await runTool("find_backhaul", { city, body: p.body, max_weight: null }, user);
    if (!result.found) return { reply: `Открытых грузов из ${city} и ближайших городов сейчас нет. Проверьте позже — новые грузы появляются в течение дня.`, cards: [] };
    return { reply: `Нашёл ${cargosN(result.found)} рядом с ${city} (искал в: ${result.searched_cities.join(", ")}):\n` + result.cargos.slice(0, 5).map((c) => `• ${c.code} ${c.route}, ${c.weight_t} т, ${c.body}, ${money(c.price_kzt)}`).join("\n"), cards };
  }

  // 3. Ставка
  if (has(s, /ставк|сколько (должен )?стои|цена|стоимост|почем|тариф/) && p.fromCity && p.toCity) {
    const { result } = await runTool("estimate_rate", { from_city: p.fromCity, to_city: p.toCity, weight: p.weight, body: p.body }, user);
    if (result.error) return { reply: result.error, cards: [] };
    return {
      reply: `${p.fromCity} → ${p.toCity}, ~${result.distanceKm} км, ${p.weight ?? 20} т, ${p.body ?? "тент"}:\n` +
        `• Рыночная ставка: ${money(result.market)} (диапазон ${money(result.low)} – ${money(result.high)})\n` +
        `• Это ~${result.perKm} ₸/км\n• Основа расчёта: ${result.basedOn}`,
      cards: [],
    };
  }

  // 4. Статистика
  if (has(s, /статист|аналит|сколько рейсов|выручк|оборот|заработ|итог|отчет/)) {
    const months = has(s, /квартал|3 мес/) ? 3 : has(s, /полгод|6 мес/) ? 6 : has(s, /год/) ? 12 : 1;
    const { result: r } = await runTool("platform_stats", { months }, user);
    if (!isLogist) {
      return { reply: `За ${months === 1 ? "последний месяц" : `${months} мес.`}: ${r.trips} ${plural(r.trips, "рейс", "рейса", "рейсов")}, ${num(r.km)} км, заработано ${money(r.earned_kzt)}.\nРейтинг ${r.rating}, всего рейсов ${r.total_trips}. Активных рейсов: ${r.active_trips}.`, cards: [] };
    }
    return {
      reply: [
        `Сводка${months > 1 ? ` за ${months} мес.` : ""}:`,
        `• Ищем машину: ${r.open_cargos}, в работе: ${r.active_trips} (в пути ${r.in_transit})`,
        `• Доставлено в этом месяце: ${r.delivered_this_month} на ${money(r.turnover_this_month_kzt)}`,
        `• Средняя ставка: ${r.avg_rate_per_km_kzt ?? "—"} ₸/км, машину находим в среднем за ${r.avg_minutes_to_find_truck ?? "—"} мин`,
        `• Свободных машин на платформе: ${r.free_drivers_on_platform}`,
        r.top_routes?.length ? `• Топ направление: ${r.top_routes[0].route} (${r.top_routes[0].trips} рейсов)` : "",
      ].filter(Boolean).join("\n"),
      cards: [],
    };
  }

  // 5. Логист: машины / водители
  if (isLogist && has(s, /машин|фур|водител|перевозчик|свободн|реф|трал|самосвал|изотерм|тент|борт|подбер|найди/)) {
    if (p.fromCity && p.toCity) return matchReply(user, { from_city: p.fromCity, to_city: p.toCity, weight: p.weight, body: p.body });
    const { result, cards } = await runTool("find_drivers", { city: p.fromCity, body: p.body, min_capacity: p.weight, status: "free", verified_only: null }, user);
    if (!result.found && p.fromCity) {
      // В городе пусто — показываем ближайшие свободные машины с таким же кузовом
      const wide = await runTool("find_drivers", { city: null, body: p.body, min_capacity: p.weight, status: "free", verified_only: null }, user);
      const near = wide.result.drivers
        .map((d) => ({ ...d, km: roadDistanceKm(d.city, p.fromCity) ?? 99999 }))
        .sort((a, b) => a.km - b.km).slice(0, 4);
      if (near.length) {
        const ids = new Set(near.map((d) => d.id));
        return {
          reply: `В ${p.fromCity} свободных машин${p.body ? ` с кузовом ${p.body}` : ""} сейчас нет. Ближайшие свободные:\n` +
            near.map((d) => `• ${d.name} — ${d.vehicle}, ${d.city} (~${d.km} км), ★${d.rating}`).join("\n"),
          cards: wide.cards.filter((c) => ids.has(c.id)),
        };
      }
    }
    if (!result.found) return { reply: `Свободных машин${p.fromCity ? ` в ${p.fromCity}` : ""}${p.body ? ` с кузовом ${p.body}` : ""} сейчас нет. Можно опубликовать груз — водители откликнутся из приложения.`, cards: [] };
    return { reply: `Свободных машин${p.fromCity ? ` в ${p.fromCity}` : ""}${p.body ? `, ${p.body}` : ""}: ${result.found}.\n` + result.drivers.slice(0, 5).map((d) => `• ${d.name} — ${d.vehicle}, ★${d.rating}, ${d.city}`).join("\n"), cards };
  }

  // 6. Грузы
  if (has(s, /груз|заявк|рейс|в пути|доставл|мои/) || (!isLogist && (p.fromCity || p.toCity))) {
    const status = has(s, /в пути|в работе|активн/) ? "active" : has(s, /доставл|заверш/) ? "delivered" : has(s, /ищ|без машин|открыт/) ? "open" : "all";
    const { result, cards } = await runTool("search_cargos", { from_city: p.fromCity, to_city: p.toCity, body: p.body, status: isLogist ? status : null, max_weight: null, limit: 8 }, user);
    if (!result.found) return { reply: "По этим условиям грузов не нашлось. Попробуйте убрать город назначения или тип кузова.", cards: [] };
    const head = isLogist ? `Нашёл ${cargosN(result.found)}:` : `Подходящие грузы (${result.found}), лучшие сверху:`;
    return { reply: head + "\n" + result.cargos.slice(0, 6).map((c) => `• ${c.code} ${c.route}, ${c.weight_t} т, ${c.body}, ${money(c.price_kzt)} — ${c.status}${c.fit_score != null ? `, подходит на ${c.fit_score}%` : ""}`).join("\n"), cards };
  }

  // В примерах — реальный код груза пользователя, чтобы пример можно было сразу повторить
  const own = await one(
    user.role === "driver"
      ? "SELECT code FROM cargos WHERE driver_id = $1 ORDER BY (status IN ('assigned','loading','in_transit')) DESC, load_date DESC LIMIT 1"
      : "SELECT code FROM cargos WHERE ($1::bigint IS NULL OR logist_id = $1) ORDER BY (status IN ('assigned','loading','in_transit')) DESC, created_at DESC LIMIT 1",
    [user.role === "admin" ? null : user.id],
  );
  return { reply: "Не понял запрос. " + HELP[user.role].join("\n").replaceAll("{CODE}", own?.code ?? "K-1001"), cards: [] };
}

async function matchReply(user, input) {
  const { result, cards } = await runTool("match_drivers", { cargo_code: null, from_city: null, to_city: null, weight: null, body: null, only_free: true, ...input }, user);
  if (result.error) return { reply: result.error, cards: [] };
  const good = result.matches.filter((m) => m.score >= 60);
  if (!good.length) {
    return { reply: `Под ${result.cargo.route}, ${result.cargo.weight_t} т, ${result.cargo.body} свободных подходящих машин сейчас нет. Можно опубликовать груз — водители увидят его в приложении и откликнутся.`, cards };
  }
  return {
    reply: `Под ${result.cargo.code ?? result.cargo.route} (${result.cargo.weight_t} т, ${result.cargo.body}) лучшие варианты:\n` +
      good.slice(0, 4).map((m) => `• ${m.name} — ${m.vehicle}, ${m.score}%: ${m.reasons.slice(0, 3).join(", ")}`).join("\n"),
    cards,
  };
}
