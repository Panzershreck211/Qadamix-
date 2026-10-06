// Локальный PostgreSQL без Docker — для разработки на машине, где Docker не запущен.
// Поднимает настоящий PostgreSQL на порту 5432 с теми же логином/паролем, что и docker-compose.yml.
// Остановка: Ctrl+C.
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, "../.pgdata");
const firstRun = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "qadamix",
  password: "qadamix_dev_password",
  port: Number(process.env.PGPORT) || 5432,
  persistent: true,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (firstRun) await pg.initialise();
await pg.start();
if (firstRun) await pg.createDatabase("qadamix");
console.log(`PostgreSQL запущен на localhost:${pg.options?.port ?? 5432}, база qadamix${firstRun ? " (создана)" : ""}. Ctrl+C — остановить.`);

const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
