import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { join } from 'path';

loadEnv({ path: join(__dirname, '..', '.env') });

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Must match typeorm.config.ts, or migrations land in a different schema
  // than the one the running app reads.
  schema: process.env.DB_SCHEMA || 'public',
  entities: [join(__dirname, '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, '..', 'db', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  connectTimeoutMS: 5000,
  // TLS for managed Postgres (Supabase, Cloud SQL public IP); off for local.
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
