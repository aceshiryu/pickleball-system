import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmConfig = (
  config: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.get<string>('DB_HOST'),
  port: Number(config.get<string>('DB_PORT')),
  username: config.get<string>('DB_USERNAME'),
  password: config.get<string>('DB_PASSWORD'),
  database: config.get<string>('DB_NAME'),
  synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
  logging: config.get<string>('DB_LOGGING') === 'true',
  // Managed Postgres (Supabase, Cloud SQL public IP) requires TLS. Gated on DB_SSL
  // so a local trust-auth Postgres keeps connecting without it.
  ssl:
    config.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
  // Bundled (webpack) build: never glob *.entity.{ts,js} at runtime — it would
  // match TypeScript source and crash with "Invalid or unexpected token".
  // autoLoadEntities registers entities from each module's forFeature([...]).
  autoLoadEntities: true,
});
