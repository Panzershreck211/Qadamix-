import crypto from "node:crypto";
import { one } from "./db.js";

const SECRET = process.env.JWT_SECRET || "dev-secret";
const TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 дней: водители не любят часто входить заново

const b64url = (buf) => Buffer.from(buf).toString("base64url");

export function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }));
  const sig = b64url(crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  const [header, body, sig] = String(token).split(".");
  if (!header || !body || !sig) return null;
  const expected = b64url(crypto.createHmac("sha256", SECRET).update(`${header}.${body}`).digest());
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp < Date.now() / 1000) return null;
  return payload;
}

/** Нормализация казахстанского номера к виду +7XXXXXXXXXX. */
export function normalizePhone(input) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) return "+7" + digits.slice(1);
  if (digits.length === 10) return "+7" + digits;
  return null;
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Middleware: требует валидный токен, кладёт пользователя в req.user. */
export function requireAuth(...roles) {
  return async (req, _res, next) => {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const payload = token && verifyToken(token);
    if (!payload) return next(new HttpError(401, "Войдите в аккаунт"));
    const user = await one("SELECT id, role, phone, name, company FROM users WHERE id = $1", [payload.sub]);
    if (!user) return next(new HttpError(401, "Аккаунт не найден"));
    if (roles.length && !roles.includes(user.role)) return next(new HttpError(403, "Недостаточно прав"));
    req.user = user;
    next();
  };
}
