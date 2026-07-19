/* eslint-disable */
import 'reflect-metadata';
import './test-env';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

// Entities + migrations imported explicitly (globs can't be required through
// jest's transform pipeline).
import { User } from '../../../api/src/users/user.entity';
import { Court } from '../../../api/src/courts/court.entity';
import { Booking } from '../../../api/src/bookings/booking.entity';
import { BookingSlot } from '../../../api/src/bookings/booking-slot.entity';
import { Override } from '../../../api/src/overrides/override.entity';
import { Settings } from '../../../api/src/settings/settings.entity';
import { ApiKey } from '../../../api/src/api-keys/api-key.entity';
import { InitSchema1784440000000 } from '../../../api/db/migrations/1784440000000-InitSchema';

const ALL_TABLES = [
  'api_keys',
  'booking_slots',
  'bookings',
  'overrides',
  'settings',
  'courts',
  'users',
];

async function ensureDatabase() {
  const dbName = process.env.DB_NAME!;
  // Safety: refuse to run against anything that isn't clearly a test DB.
  if (!/e2e|test/i.test(dbName)) {
    throw new Error(
      `Refusing to run e2e against non-test database "${dbName}". Set E2E_DB_NAME to a *_e2e / *_test database.`,
    );
  }
  const admin = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD || undefined,
    database: 'postgres',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await admin.connect();
  try {
    const exists = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName}"`);
      console.log(`  created test database "${dbName}"`);
    }
  } finally {
    await admin.end();
  }
}

module.exports = async function () {
  console.log('\n[e2e] setting up test database…');
  await ensureDatabase();

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [User, Court, Booking, BookingSlot, Override, Settings, ApiKey],
    migrations: [InitSchema1784440000000],
  });
  await ds.initialize();

  // uuid_generate_v4() default relies on the uuid-ossp extension.
  await ds.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  await ds.runMigrations();

  // Clean slate each run.
  await ds.query(
    `TRUNCATE TABLE ${ALL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );

  // Seed the two access accounts the tests log in with (password: demo1234).
  const userRepo = ds.getRepository(User);
  const hash = await bcrypt.hash(
    'demo1234',
    Number(process.env.BCRYPT_ROUNDS ?? 4),
  );
  await userRepo.save([
    userRepo.create({ email: 'admin@pickleplay.co', passwordHash: hash, role: 'admin', name: 'Admin' }),
    userRepo.create({ email: 'jamie@pickleplay.co', passwordHash: hash, role: 'staff', name: 'Jamie Cruz' }),
  ]);

  // The suite tests a live, configured facility, so mark onboarding done —
  // otherwise OnboardingGuard would 403 every booking write. The guard itself
  // is covered by its own spec, which clears this flag and restores it.
  await ds.query(`
    INSERT INTO "settings" ("id", "onboarding_completed_at") VALUES (1, now())
    ON CONFLICT ("id") DO UPDATE SET "onboarding_completed_at" = now()
  `);

  await ds.destroy();
  console.log('[e2e] test database ready.\n');
};
