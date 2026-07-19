// Truncates the browser-suite database so every run starts production-shaped:
// the seeded admin and nothing else. Runs AFTER migrations (the tables have to
// exist) and BEFORE the seed (which recreates the admin).
//
// Without this the database accumulates courts, bookings and customers across
// runs, and specs that assert "no courts yet" or drive onboarding pass once and
// then fail forever.
import pkg from 'pg';

const { Client } = pkg;

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 5433);
const user = process.env.DB_USERNAME || 'acecerio';
const password = process.env.DB_PASSWORD || undefined;
const dbName = process.env.DB_NAME || 'pickleball_web_e2e';

// Same guard as ensure-db: never truncate something that isn't a test database.
if (!/e2e|test/i.test(dbName)) {
  console.error(`[web-e2e] refusing to truncate non-test database "${dbName}"`);
  process.exit(1);
}

const db = new Client({ host, port, user, password, database: dbName });
await db.connect();

// Discover tables rather than hardcoding a list — one less thing to update
// when a migration adds a table. migrations is excluded so the schema isn't
// re-run; settings is included so onboarding starts unfinished.
const { rows } = await db.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename <> 'migrations'
`);

if (rows.length) {
  const list = rows.map((r) => `"${r.tablename}"`).join(', ');
  await db.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  console.log(`[web-e2e] truncated ${rows.length} tables in "${dbName}".`);
}

await db.end();
