import Anthropic from "@anthropic-ai/sdk";

// Ассистент работает через Claude, если задан ключ. Без ключа — режим правил (см. rules.js).
export const claude = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
export const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
