import { execSync } from "node:child_process";
import pg from "pg";
import { testDatabaseUrl } from "./test-db";

/** Crea la BD de pruebas si no existe y le aplica las migraciones. Se ejecuta una vez por sesión. */
export default async function setup() {
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.replace(/^\//, "");

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (!rowCount) await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, "")}"`);
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url },
  });
}
