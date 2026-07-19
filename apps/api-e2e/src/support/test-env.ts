/* eslint-disable */
// Shared test environment for the API e2e suite. Imported by both the jest
// globalSetup (main process) and setupFiles (each worker) so the booted Nest
// app and the migration runner all point at the SAME dedicated test database.
//
// DB_NAME is forced to the e2e database (never the dev DB), so running the
// suite can never touch or truncate development data.

export const E2E_DB_NAME = process.env.E2E_DB_NAME ?? 'pickleball_e2e';

process.env.NODE_ENV = 'test';

// Connection — defaults match local dev (Postgres.app), overridable via env/CI.
process.env.DB_HOST ??= '127.0.0.1';
process.env.DB_PORT ??= '5433';
process.env.DB_USERNAME ??= 'acecerio';
process.env.DB_PASSWORD ??= '';
process.env.DB_SSL ??= 'false';

// Force the isolated e2e database (unconditional — wins over any inherited value).
process.env.DB_NAME = E2E_DB_NAME;

// Schema comes from migrations run in globalSetup; the app must not sync.
process.env.DB_SYNCHRONIZE = 'false';
process.env.DB_LOGGING ??= 'false';

// Auth + test-speed knobs.
process.env.JWT_SECRET ??= 'e2e-test-secret';
process.env.JWT_EXPIRES_IN ??= '1h';
process.env.BCRYPT_ROUNDS ??= '4'; // fast hashing for tests
process.env.THROTTLE_TTL ??= '60';
process.env.THROTTLE_LIMIT ??= '100000'; // avoid rate-limit flakiness under load
