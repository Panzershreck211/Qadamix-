import Anthropic from "@anthropic-ai/sdk";
import { one, query } from "../db.js";
import { HttpError } from "../auth.js";
import { claude, MODEL } from "./claude.js";
import { toolsForRole, runTool } from "./tools.js";
import { answerWithRules } from "./rules.js";

const MAX_TOOL_ROUNDS = 8;

function systemPrompt(user) {
  const who = {
    logist: `логист${user.company ? ` компании «${user.company}»` : ""}. Помогай находить машины под грузы, свободных водителей, оценивать ставки, следить за рейсами и разбирать аналитику`,
    driver: "водитель-перевозчик. Помогай находить подходящие грузы, обратную загрузку, оценивать ставку и следить за своими рейсами",
    admin: "администратор платформы",
  }[user.role];
  return [
    `Ты — AI-диспетчер платформы грузоперевозок QADAMIX (Казахстан). Пользователь — ${user.name}, ${who}.`,
    `Сегодня ${new Date().toISOString().slice(0, 10)}.`,
    "Все факты о грузах, водителях, ставках и рейсах бери только из инструментов. Если инструмент ничего не нашёл — так и скажи и предложи, как расширить поиск. Никогда не придумывай водителей, грузы, телефоны или цифры.",
    "Если запрос неоднозначный (нет города, веса или кузова, и это важно для ответа), задай один короткий уточняющий вопрос.",
    "Если вопрос не про логистику и платформу, вежливо скажи, с чем ты можешь помочь.",
    "Отвечай по-русски, коротко и по делу: сначала вывод, потом 2–5 пунктов. Деньги пиши как «295 000 ₸», грузы — по коду (K-1042). Карточки найденных грузов и водителей интерфейс покажет сам, не переписывай все поля — выдели главное и объясни выбор.",
  ].join("\n");
}

async function loadSession(user, conversationId) {
  if (conversationId) {
    const s = await one("SELECT id, messages FROM chat_sessions WHERE id = $1 AND user_id = $2", [conversationId, user.id]);
    if (!s) throw new HttpError(404, "Диалог не найден");
    return s;
  }
  return one("INSERT INTO chat_sessions (user_id) VALUES ($1) RETURNING id, messages", [user.id]);
}

function dedupeCards(cards) {
  const seen = new Set();
  return cards.filter((c) => {
    const key = `${c.type}:${c.code ?? c.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function chat(user, conversationId, text) {
  const session = await loadSession(user, conversationId);
  // История дописывается и никогда не редактируется: блоки thinking/tool_use возвращаются в API без изменений.
  const messages = [...session.messages, { role: "user", content: text }];
  let reply, cards = [], mode;

  if (claude) {
    mode = "claude";
    const tools = toolsForRole(user.role);
    let response;
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      try {
        response = await claude.beta.messages.create({
          model: MODEL,
          max_tokens: 16000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default", // при отказе модели запрос автоматически дообслужит резервная модель
          output_config: { effort: "medium" },
          system: systemPrompt(user),
          tools,
          messages,
        });
      } catch (e) {
        if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, "Ассистент перегружен, повторите через минуту");
        if (e instanceof Anthropic.AuthenticationError) throw new HttpError(503, "Неверный ключ Claude API — проверьте ANTHROPIC_API_KEY");
        if (e instanceof Anthropic.APIError) throw new HttpError(502, `Ассистент недоступен (${e.status})`);
        throw e;
      }
      messages.push({ role: "assistant", content: response.content });

      if (response.stop_reason === "pause_turn") continue;
      if (response.stop_reason !== "tool_use") break;

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      const results = await Promise.all(toolUses.map(async (t) => {
        try {
          const { result, cards: c } = await runTool(t.name, t.input, user);
          cards.push(...c);
          return { type: "tool_result", tool_use_id: t.id, content: JSON.stringify(result), ...(result?.error ? { is_error: true } : {}) };
        } catch (e) {
          console.error(`[assistant] ${t.name} failed:`, e);
          return { type: "tool_result", tool_use_id: t.id, content: "Внутренняя ошибка при выполнении запроса к базе", is_error: true };
        }
      }));
      // Все результаты параллельных вызовов — одним сообщением пользователя
      messages.push({ role: "user", content: results });
    }

    if (response.stop_reason === "refusal") {
      reply = "Не могу помочь с этим запросом. Спросите про грузы, машины, ставки или рейсы.";
    } else {
      reply = response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim()
        || "Не получилось сформулировать ответ. Попробуйте переформулировать вопрос.";
    }
  } else {
    mode = "rules";
    ({ reply, cards } = await answerWithRules(user, text));
    messages.push({ role: "assistant", content: reply });
  }

  await query("UPDATE chat_sessions SET messages = $2, updated_at = now() WHERE id = $1", [session.id, JSON.stringify(messages)]);
  return { conversationId: session.id, reply, cards: dedupeCards(cards).slice(0, 12), mode };
}
