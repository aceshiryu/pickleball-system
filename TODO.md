# Pickleball System — TODO

Working list. `[x]` = done this session, `[ ]` = pending.

## Image storage → Supabase (NEW)
**Decision:** images are stored in **Supabase Storage**, not inline in Postgres.

Today every image is a base64 `data:` URL held in a text column (there was no
object storage). Migrate these to Supabase Storage buckets, replacing the
inline data with a stored file path / signed URL.

Surfaces to migrate:
- [x] **Receipt photos** — uploaded to the private `receipts` bucket, served as
      short-lived signed URLs, deleted from Storage on approve/reject. The
      booking keeps `proofRecorded` so the UI shows "Receipt recorded — image
      removed after review" instead of erroring.
- [ ] **Brand logo** — `settings.logo_url` (text data URL) → Supabase. Upload in
      web `Settings.tsx` (`pickLogo`), served publicly via `GET /settings`
      (landing/login read it pre-auth) — needs a public bucket or long-lived
      signed URL.
- [x] **Payment QRs** — dropped, not migrated. The module only ever held a label
      and a filename with no file behind it. Replaced by an editable
      `settings.payment_methods` list; the `todos` scaffolding module went with it.
- [x] Supabase client + bucket config — `StorageService` (`storage/`), env vars in
      `.env.example`. Degrades to disabled (inline fallback) when unconfigured.
- [ ] Drop the DB size caps / data-URL validators once the logo moves to Storage
      (`update-settings.dto.ts` logo `@Matches`/`@MaxLength`, `booking-dtos.ts`
      proof `@Matches`/`@MaxLength`).

## Original list
1. [x] **Saving of photos for receipts** — done (currently inline; superseded by
       the Supabase item above). Image purged on approve *and* reject.
2. [x] **Seed should only be an admin account** — single admin
       `admin@pickleplay.co` / `P@ssw0rd123` (env-overridable). Staff seed removed.
3. [x] **Add courts feature** — restored the "Add a court" card + modal in Court
       management (admin-only, POST /courts).
4. [x] **Admin onboarding in the dashboard** — blocking modal (5 steps + a final
       review) and a server-side `OnboardingGuard` refusing writes until finished.
5. [x] **Brand Settings: upload photo + update name** — done (logo upload +
       app-name fix; storage moves to Supabase per the item above).
6. [x] **Brand Settings: set font dynamically, system-wide** — 6 font pairings,
       applied via CSS vars (`--font-display`/`--font-body`), webfont loaded on demand.
7. [x] **Brand Settings: secondary derived from primary** — one "Brand color"
       picker; secondary + tint computed in `lib/color.ts` and always derived at
       render. NOTE: derived as a *deep* shade, not lighter — secondary drives the
       dark chrome (sidebar, buttons) that carries white text. See the caveat below.
