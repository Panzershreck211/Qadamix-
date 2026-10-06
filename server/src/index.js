import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { migrate, pool } from "./db.js";
import { HttpError } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { cargosRouter } from "./routes/cargos.js";
import { miscRouter } from "./routes/misc.js";
import { gpsRouter } from "./routes/gps.js";
import { claude } from "./assistant/claude.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "200kb" }));

app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ ok: true, assistant: claude ? "claude" : "rules" });
});
app.use("/api/auth", authRouter);
app.use("/api", cargosRouter);
app.use("/api", miscRouter);
app.use("/api", gpsRouter);

app.use("/api", (_req, _res, next) => next(new HttpError(404, "Метод API не найден")));

app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues.map((i) => i.message).join("; "), fields: err.issues.map((i) => i.path.join(".")) });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Некорректный JSON" });
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

await migrate();
const port = Number(process.env.PORT) || 4000;
app.listen(port, "0.0.0.0", () => {
  console.log(`QADAMIX API: http://localhost:${port}/api  (ассистент: ${claude ? "Claude" : "режим правил — задайте ANTHROPIC_API_KEY"})`);
});
