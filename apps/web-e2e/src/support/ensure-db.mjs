// Ensures the isolated e2e database exists (+ uuid-ossp) before the API server
// migrates and boots. Run from the API webServer command in playwright.config.
import pkg from 'pg';

const { Client } = pkg;

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 5433);
const user = process.env.DB_USERNAME || 'acecerio';
const password = process.env.DB_PASSWORD || undefined;
const dbName = process.env.DB_NAME || 'pickleball_web_e2e';

// Safety: never touch a non-test database.
if (!/e2e|test/i.test(dbName)) {
  console.error(`[web-e2e] refusing to use non-test database "${dbName}"`);
  process.exit(1);
}

const admin = new Client({ host, port, user, password, database: 'postgres' });
await admin.connect();
const existing = await admin.query(
  'SELECT 1 FROM pg_database WHERE datname = $1',
  [dbName],
);
if (existing.rowCount === 0) {
  await admin.query(`CREATE DATABASE "${dbName}"`);
  console.log(`[web-e2e] created database "${dbName}"`);
}
await admin.end();

// uuid_generate_v4() (used by the migrations) needs the uuid-ossp extension.
const db = new Client({ host, port, user, password, database: dbName });
await db.connect();
await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
await db.end();
console.log(`[web-e2e] database "${dbName}" ready.`);
