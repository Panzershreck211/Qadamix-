import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { one, tx, query } from "../db.js";
import { normalizePhone, signToken, requireAuth, HttpError } from "../auth.js";
import { normalizeCity } from "../cities.js";
import { BODY_TYPES } from "../matching.js";

export const authRouter = Router();
const OTP_TTL_MIN = 5;
const MAX_ATTEMPTS = 5;

authRouter.post("/request-code", async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) throw new HttpError(400, "Введите номер в формате +7 7XX XXX XX XX");
  const code = String(crypto.randomInt(1000, 10000));
  await query(
    `INSERT INTO otp_codes (phone, code, attempts, expires_at) VALUES ($1, $2, 0, now() + $3::interval)
     ON CONFLICT (phone) DO UPDATE SET code = EXCLUDED.code, attempts = 0, expires_at = EXCLUDED.expires_at`,
    [phone, code, `${OTP_TTL_MIN} minutes`],
  );
  // SMS-провайдер ещё не подключён: в разработке показываем код в ответе и в логе сервера.
  console.log(`[otp] ${phone}: ${code}`);
  const exists = !!(await one("SELECT 1 FROM users WHERE phone = $1", [phone]));
  res.json({ phone, isNewUser: !exists, ...(process.env.DEV_SHOW_OTP === "true" ? { devCode: code } : {}) });
});

const VerifyBody = z.object({
  phone: z.string(),
  code: z.string().regex(/^\d{4}$/, "Код — 4 цифры"),
  // Для регистрации нового пользователя:
  role: z.enum(["logist", "driver"]).optional(),
  name: z.string().trim().min(2).max(80).optional(),
  company: z.string().trim().max(120).optional(),
  city: z.string().optional(),
  body: z.enum(BODY_TYPES).optional(),
  capacity: z.coerce.number().positive().max(80).optional(),
  vehicleModel: z.string().trim().max(60).optional(),
});

authRouter.post("/verify", async (req, res) => {
  const data = VerifyBody.parse(req.body);
  const phone = normalizePhone(data.phone);
  if (!phone) throw new HttpError(400, "Неверный номер телефона");

  const otp = await one("SELECT code, attempts, expires_at < now() AS expired FROM otp_codes WHERE phone = $1", [phone]);
  if (!otp || otp.expired) throw new HttpError(400, "Код устарел. Запросите новый");
  if (otp.attempts >= MAX_ATTEMPTS) throw new HttpError(429, "Слишком много попыток. Запросите новый код");
  if (otp.code !== data.code) {
    await query("UPDATE otp_codes SET attempts = attempts + 1 WHERE phone = $1", [phone]);
    throw new HttpError(400, "Неверный код");
  }

  let user = await one("SELECT id, role, phone, name, company FROM users WHERE phone = $1", [phone]);
  if (!user) {
    if (!data.role || !data.name) {
      // Код верный, но аккаунта нет: клиент должен показать форму регистрации и повторить запрос.
      return res.status(409).json({ error: "Укажите роль и имя для регистрации", needsRegistration: true });
    }
    const city = normalizeCity(data.city);
    if (data.role === "driver" && !city) throw new HttpError(400, "Укажите город, где сейчас машина");
    user = await tx(async (c) => {
      const u = await one(
        "INSERT INTO users (role, phone, name, company) VALUES ($1, $2, $3, $4) RETURNING id, role, phone, name, company",
        [data.role, phone, data.name, data.company ?? null], c,
      );
      if (data.role === "driver") {
        await query(
          `INSERT INTO drivers (user_id, city, body, capacity, vehicle_model, verify) VALUES ($1, $2, $3, $4, $5, 'pending')`,
          [u.id, city, data.body ?? null, data.capacity ?? null, data.vehicleModel ?? null], c,
        );
      }
      return u;
    });
  }
  await query("DELETE FROM otp_codes WHERE phone = $1", [phone]);
  res.json({ token: signToken({ sub: user.id, role: user.role }), user });
});

authRouter.get("/me", requireAuth(), async (req, res) => {
  const driver = req.user.role === "driver"
    ? await one("SELECT * FROM drivers WHERE user_id = $1", [req.user.id])
    : null;
  res.json({ user: req.user, driver });
});
