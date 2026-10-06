import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

// COUNT(*) возвращает bigint, AVG — numeric; в JS отдаём числами, а не строками.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
// DATE отдаём строкой YYYY-MM-DD, без сдвига часового пояса.
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://qadamix:qadamix_dev_password@localhost:5432/qadamix",
  max: 10,
});
// Обрыв простаивающего соединения (перезапуск базы) не должен ронять процесс — пул переподключится сам.
pool.on("error", (err) => console.error("[db] соединение потеряно:", err.message));

/** Выполнить запрос в пуле или в переданном клиенте транзакции. */
export const query = (sql, params = [], client = pool) => client.query(sql, params);
export const one = async (sql, params = [], client) => (await query(sql, params, client)).rows[0] ?? null;
export const all = async (sql, params = [], client) => (await query(sql, params, client)).rows;

/** Транзакция: fn получает клиента, все запросы внутри идут через него. */
export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Применяет миграции из server/migrations по порядку, каждую один раз. */
export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const dir = path.resolve(here, "../migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set((await all("SELECT name FROM schema_migrations")).map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await tx(async (c) => {
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    console.log(`migration applied: ${file}`);
  }
}

export async function notify(userId, title, body, link = null, client) {
  await query(
    "INSERT INTO notifications (user_id, title, body, link) VALUES ($1, $2, $3, $4)",
    [userId, title, body, link],
    client,
  );
}
