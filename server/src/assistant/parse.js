import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, MODEL } from "./claude.js";
import { findCitiesInText, normalizeCity, CITY_NAMES } from "../cities.js";
import { BODY_TYPES } from "../matching.js";

// Поля груза, которые ассистент извлекает из свободного текста заявки.
const ParsedCargo = z.object({
  fromCity: z.string().nullable().describe("Город загрузки"),
  toCity: z.string().nullable().describe("Город выгрузки"),
  loadDate: z.string().nullable().describe("Дата загрузки YYYY-MM-DD"),
  weight: z.number().nullable().describe("Вес, тонн"),
  volume: z.number().nullable().describe("Объём, м³"),
  body: z.enum(BODY_TYPES).nullable(),
  kind: z.string().nullable().describe("Что за груз"),
  price: z.number().nullable().describe("Ставка в тенге"),
  notes: z.string().nullable().describe("Особые условия"),
});

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export async function parseCargoText(text) {
  if (claude) {
    try {
      const response = await claude.messages.parse({
        model: MODEL,
        max_tokens: 2000,
        output_config: { effort: "low", format: zodOutputFormat(ParsedCargo) },
        system:
          `Ты извлекаешь параметры грузоперевозки из сообщения логиста (часто это пересланное сообщение из WhatsApp). ` +
          `Сегодня ${today()}. Города приводи к написанию из списка: ${CITY_NAMES.join(", ")}. ` +
          `«300к» = 300000 тенге. «Реф» = Рефрижератор, «фура» без уточнения = Тент. ` +
          `Если параметра в тексте нет, верни null — не придумывай.`,
        messages: [{ role: "user", content: text }],
      });
      if (response.stop_reason !== "refusal" && response.parsed_output) {
        return { ...clean(response.parsed_output), source: "claude" };
      }
    } catch (e) {
      console.error("[parse] Claude недоступен, разбираю правилами:", e.message);
    }
  }
  return { ...clean(parseWithRules(text)), source: "rules" };
}

function clean(p) {
  return { ...p, fromCity: normalizeCity(p.fromCity), toCity: normalizeCity(p.toCity) };
}

const BODY_WORDS = [
  [/реф|рефриж/i, "Рефрижератор"], [/изотерм/i, "Изотерм"], [/самосвал/i, "Самосвал"],
  [/трал|низкорам/i, "Низкорамный трал"], [/контейнер/i, "Контейнер"], [/цистерн|налив/i, "Цистерна"],
  [/борт/i, "Борт"], [/тент|фур/i, "Тент"],
];

/** Разбор без LLM: города, тоннаж, кузов, ставка, дата. */
export function parseWithRules(text) {
  const s = text.toLowerCase().replace(/ё/g, "е");
  const cities = findCitiesInText(s);
  const num = (v) => Number(String(v).replace(/\s/g, "").replace(",", "."));

  // \b в JS не работает с кириллицей, поэтому конец слова проверяем через lookahead
  const END = "(?=[^а-яa-z]|$)";
  const w = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:тонн[а-я]*|тн|т)${END}`));
  const v = s.match(/(\d+(?:[.,]\d+)?)\s*(?:м3|м³|куб)/);
  const body = BODY_WORDS.find(([re]) => re.test(s))?.[1] ?? null;

  let price = null;
  const pk = s.match(new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(?:тыс[а-я]*|к|k)${END}`));
  const pt = s.match(/(\d[\d\s]{3,})\s*(?:₸|тг|тенге)/);
  if (pk) price = Math.round(num(pk[1]) * 1000);
  else if (pt) price = num(pt[1]);

  let loadDate = null;
  if (/послезавтра/.test(s)) loadDate = addDays(2);
  else if (/завтра/.test(s)) loadDate = addDays(1);
  else if (/сегодня/.test(s)) loadDate = today();
  else {
    const d = s.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
    if (d) {
      const year = d[3] ? (d[3].length === 2 ? "20" + d[3] : d[3]) : new Date().getFullYear();
      loadDate = `${year}-${d[2].padStart(2, "0")}-${d[1].padStart(2, "0")}`;
    }
  }

  return {
    fromCity: cities[0] ?? null, toCity: cities[1] ?? null, loadDate,
    weight: w ? num(w[1]) : null, volume: v ? num(v[1]) : null, body,
    kind: null, price, notes: null,
  };
}
