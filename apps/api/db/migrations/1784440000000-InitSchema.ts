import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema — the squash of every migration written during development
 * (1784038979772 through 1784430000000), collapsed into the final shape.
 *
 * The incremental history is gone on purpose: it carried two dropped features
 * (`todos`, `payment_qrs`), a dozen ALTER TABLEs that only ever ran against a
 * development database, and backfills for rows that no longer exist anywhere.
 * Nothing was ever deployed, so there is no installed base to migrate from.
 *
 * This runs against an empty database. It has no `down` worth the name — the
 * inverse of "create the whole schema" is "drop the database".
 */
export class InitSchema1784440000000 implements MigrationInterface {
  name = 'InitSchema1784440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ids default to gen_random_uuid(), which is core Postgres 13+ and lives in
    // pg_catalog — always on the search_path, no extension required.
    //
    // The earlier history used uuid_generate_v4() from uuid-ossp. That is not
    // enabled by default in a fresh database, and on Supabase the extension is
    // installed into a separate `extensions` schema, so the function may not
    // resolve at all depending on the connection's search_path — the migration
    // would die on the first CREATE TABLE.

    // --- users -------------------------------------------------------------
    // password_hash is nullable: customers sign in with Google and never have
    // one. google_sub is nullable for the mirror-image reason — admin/staff sign
    // in with a password and never have one.
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying NOT NULL,
        "password_hash" character varying,
        "name" character varying NOT NULL DEFAULT '',
        "phone" character varying,
        "role" character varying NOT NULL DEFAULT 'customer',
        "google_sub" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
    // Two accounts must never claim the same Google identity. Postgres treats
    // NULLs as distinct under UNIQUE, so every password-only account coexists.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_google_sub" ON "users" ("google_sub")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_users_deleted_at" ON "users" ("deleted_at")`,
    );

    // --- courts ------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "courts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "surface" character varying NOT NULL,
        "peak_rate" integer NOT NULL,
        "off_peak_rate" integer NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_courts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_courts_deleted_at" ON "courts" ("deleted_at")`,
    );

    // --- settings ----------------------------------------------------------
    // One row per deployment, id pinned to 1. SettingsService.ensure() creates
    // it on first read, so nothing is inserted here.
    // close_hour is exclusive: the last bookable slot starts at close_hour - 1,
    // and 0 to 24 means open all day.
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" integer NOT NULL DEFAULT 1,
        "app_name" character varying NOT NULL DEFAULT 'AfterHours',
        "primary" character varying NOT NULL DEFAULT '#6B2B2B',
        "secondary" character varying NOT NULL DEFAULT '#6E7275',
        "logo_url" text,
        "font_family" character varying NOT NULL DEFAULT 'space-grotesk',
        "open_hour" integer NOT NULL DEFAULT 6,
        "close_hour" integer NOT NULL DEFAULT 22,
        "peak_hours_weekday" integer array NOT NULL DEFAULT '{17,18,19,20,21}',
        "peak_hours_weekend" integer array NOT NULL DEFAULT '{6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21}',
        "payment_methods" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "onboarding_completed_at" TIMESTAMP WITH TIME ZONE,
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "CHK_settings_hours" CHECK ("close_hour" > "open_hour"),
        CONSTRAINT "PK_settings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_settings_deleted_at" ON "settings" ("deleted_at")`,
    );

    // --- overrides (blackouts) ---------------------------------------------
    // court_id is varchar, not a uuid FK: "all" is a legal value meaning every
    // court.
    await queryRunner.query(`
      CREATE TABLE "overrides" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "label" character varying NOT NULL,
        "reason" character varying NOT NULL,
        "court_id" character varying NOT NULL,
        "scope" character varying NOT NULL,
        "date" date NOT NULL,
        "start_hour" integer,
        "end_hour" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_overrides_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_overrides_deleted_at" ON "overrides" ("deleted_at")`,
    );

    // --- bookings ----------------------------------------------------------
    // customer_id is nullable: a walk-in taken at the front desk need not have
    // an account, which is why contact_* lives on the booking itself rather
    // than being read through the user.
    //
    // proof_image is the legacy inline data: URL. Receipts now go to Supabase
    // Storage (proof_path), but the entity still maps this column.
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "ref" character varying NOT NULL,
        "customer_id" uuid,
        "court_id" uuid NOT NULL,
        "contact_name" character varying NOT NULL DEFAULT '',
        "contact_phone" character varying NOT NULL DEFAULT '',
        "contact_email" character varying,
        "hours" integer NOT NULL,
        "total" integer NOT NULL,
        "status" character varying NOT NULL,
        "note" text,
        "hold_expires_at" TIMESTAMP WITH TIME ZONE,
        "seen_by_admin" boolean NOT NULL DEFAULT false,
        "payment_method" character varying,
        "payment_reference" character varying,
        "proof_file_name" character varying,
        "proof_image" text,
        "proof_path" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "UQ_bookings_ref" UNIQUE ("ref"),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_bookings_deleted_at" ON "bookings" ("deleted_at")`,
    );

    // --- booking_slots (one row per reserved court-hour) -------------------
    // rate is the price charged for that hour, frozen at booking time so later
    // court-rate or peak-hour changes never reprice an existing hold/booking.
    await queryRunner.query(`
      CREATE TABLE "booking_slots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "booking_id" uuid NOT NULL,
        "date" date NOT NULL,
        "hour" integer NOT NULL,
        "rate" integer NOT NULL DEFAULT 0,
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_booking_slots_id" PRIMARY KEY ("id")
      )
    `);
    // Availability and conflict checks scan by date+hour on every booking write.
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_slots_date_hour" ON "booking_slots" ("date", "hour")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_booking_slots_deleted_at" ON "booking_slots" ("deleted_at")`,
    );

    // --- api_keys ----------------------------------------------------------
    // Machine callers (the MCP server, scripts). Only the SHA-256 hash is
    // stored; the raw `pickleball-…` value is shown once at creation.
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying NOT NULL,
        "key_hash" character varying NOT NULL,
        "prefix" character varying NOT NULL,
        "user_id" uuid NOT NULL,
        "last_used_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_api_keys_id" PRIMARY KEY ("id")
      )
    `);
    // Every authenticated machine request looks the key up by hash.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_api_keys_key_hash" ON "api_keys" ("key_hash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_api_keys_deleted_at" ON "api_keys" ("deleted_at")`,
    );

    // --- foreign keys ------------------------------------------------------
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_customer"
      FOREIGN KEY ("customer_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_court"
      FOREIGN KEY ("court_id") REFERENCES "courts"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "booking_slots" ADD CONSTRAINT "FK_booking_slots_booking"
      FOREIGN KEY ("booking_id") REFERENCES "bookings"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "api_keys" ADD CONSTRAINT "FK_api_keys_user"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Child tables first — the FKs cascade on delete, not on drop.
    await queryRunner.query(`DROP TABLE IF EXISTS "api_keys"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "booking_slots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "bookings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "overrides"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "settings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "courts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
    // The extension is left alone — it may predate this schema.
  }
}
