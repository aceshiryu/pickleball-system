<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Pickleball system

NestJS `api` + Next.js `web` court booking system. Everything below is project-specific
and sits outside the nx-managed fence above — don't move it inside, nx rewrites that block.

## Environment gotchas

- **Run nx from this directory**, not the `ace-for-all` repo root. The root is a separate
  workspace; running `nx typecheck` there produces ~113 unrelated errors.
- **Node is pinned to v22.22.1** (`.nvmrc`) but the shell default may be v10, which fails with
  `Unexpected token ?` inside `typescript.js`. Export the path explicitly when a command fails
  that way: `export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"`.
- **Don't run migrations or seeds** — the local Postgres.app rejects agent connections. Write the
  migration file and let Ace run `npm run migration` / `npm run seed`.

## Dates: the pg driver returns `Date`, not `string`

The single most consequential bug in this codebase. Postgres OID 1082 (`date`) comes back from
raw queries as a JS `Date` pinned to **local** midnight, because `getRawMany()` bypasses
TypeORM's hydration. Calling `.toISOString()` on it shifts the day backwards in any timezone
west of UTC, which silently breaks hold/conflict matching.

Always normalise through `toISODate()` in [bookings.service.ts](apps/api/src/bookings/bookings.service.ts:45),
which reads local `getFullYear()`/`getMonth()`/`getDate()` parts. Never `.toISOString().slice(0,10)`.

## Booking invariants

- **Prices are frozen at booking time.** `booking_slots.rate` is stored, never recomputed.
  Changing court rates or peak-hour config must not reprice an existing hold or booking;
  unbooked slots do reprice.
- **Holds are partial blocks.** A `hold` occupies the slot for 10 minutes, then
  `releaseExpiredHolds()` **cancels** the booking (it does not delete it) and reopens the slot.
- Availability checks must match `hold` and `checked_in` alongside `confirmed` and
  `pending_approval` — missing the first two showed occupied slots as "Open".
- Conflicts are enforced server-side (`assertSlotsFree` → 409, `assertWithinOpeningHours` → 400),
  not just hidden in the UI.

## Guest booking

Customers can book **without an account**; signing in is optional and offered afterwards.
`bookings.customerId` is nullable (walk-ins already used this) and `contactName/Phone/Email`
carry the guest's details.

- **Ownership is a claim token, not email.** A guest hold (`POST /bookings/guest/hold`) generates
  a secret `booking.guest_token`, returned once. The browser keeps `{token, ids}` in
  `localStorage` (`pkl_guest`). Every guest-only call — `guest/submit-payment`, `guest/release-holds`,
  `guest/lookup` — presents the token, and the service checks it (`assertOwnsAll`) before touching
  a row. Possession of the token IS the authorization; there is no email-matching (which would let
  a guest hand a booking to whoever owns that address).
- **Claim on login.** After Google sign-in the browser POSTs its tokens to `POST /bookings/claim`
  (authed), which sets `customer_id` and nulls the token. `store.googleLogin()` does this, then
  clears `localStorage`.
- **Two tiers of openness, on purpose:**
  - **Public reads** (no guard): `GET /bookings/availability`, `GET /courts`, `GET /overrides`,
    `GET /settings`. The calendar (and landing/login branding) must render before sign-in. No PII,
    except `settings` carries the facility's payment details — the accepted trade-off of an open
    checkout. Kept open deliberately so a web-key misconfig can't blank the whole app.
  - **Web-key gated** (`PublicKeyGuard`): the guest booking flow — `guest/hold`,
    `guest/submit-payment`, `guest/release-holds`, `guest/lookup`. The web apps ship a shared
    `WEB_PUBLIC_API_KEY` as `NEXT_PUBLIC_WEB_KEY` and send it as `X-Web-Key`.
- The web key is a **bar, not a secret** — it's extractable from the browser bundle, so it blocks
  casual/scripted/direct booking but doesn't authenticate. It unlocks ONLY the guest flow; admin/data
  endpoints stay on `ApiAuthGuard + @Roles`, and an admin `pickleball-…` key must never go in the
  browser. The gate is **inactive until `WEB_PUBLIC_API_KEY` is set** (dev + un-provisioned deploys
  keep working); set it in production to turn it on. **Both-or-neither:** the API's `WEB_PUBLIC_API_KEY`
  and the apps' `NEXT_PUBLIC_WEB_KEY` must match (the latter is build-time inlined — changing it needs
  a rebuild), or every guest booking 401s.
- There is deliberately no public `/auth/register` (it used to mint admin accounts).
- **Web routing:** `/book` is the guest-capable calendar; `/login` is explicit sign-in only and
  redirects to `/book` once authed. The store branches every booking action on `loggedIn`, and the
  bookings query looks guests up by token instead of `/bookings/mine`.
- **Known gap:** `GET /bookings/:id/proof` is still authed, so a guest can't re-view a receipt they
  just uploaded (submitting works). Add a token-scoped guest proof endpoint if that's needed.

## Persistence

- **All entities are soft-delete capable** (`@DeleteDateColumn`). Hard deletes would cascade
  through booking history.
- Migrations are hand-written under `apps/api/db/migrations/`. Every new one must **also** be
  imported and listed in [global-setup.ts](apps/api-e2e/src/support/global-setup.ts) — globs
  can't be required through the e2e harness, so a missing import means the e2e schema drifts.
- Seed is a single admin: `admin@pickleplay.co` / `P@ssw0rd123`, overridable via
  `SEED_ADMIN_PASSWORD`.

## Payment methods

The facility's accepted methods live in `settings.payment_methods`, a **jsonb** array
of structured objects (`PaymentMethod`): `{ id, type, label, ...details, qr? }`. `type`
is one of `gcash | maya | bank | cash | other` and drives which detail fields apply and
how checkout renders it:

- **gcash / maya** — `phone` required, `qr` optional
- **bank** — `bankName` + `accountNumber` + `accountName` required, `qr` optional; `label`
  tracks the bank name (what the customer picks)
- **cash / other** — label only

Customers pick one at checkout and **see its details + QR** (shared `PaymentInstructions`),
so this is customer-facing config, not just a label. Staff record the chosen `label` on
approval. The admin editor is the shared `PaymentMethods` component (onboarding + Settings
both render it, so they can't drift): pick a type → fill a draft form → save into the list →
edit/remove. Per-type required fields are enforced client-side **and** server-side via
`PaymentMethodDto` (`@ValidateIf` by type). Onboarding still requires at least one method.

The old `payment_qrs` table and the labels-only `text[]` were both interim: the QR module
stored a filename with no file, and labels alone couldn't tell a customer how to pay. This
is the real version Ace asked for. QRs ride inline as data: URLs (same convention as the
logo, capped ~128KB each) — when the logo moves to Supabase, move these with it.

The `settings.update()` service must persist `paymentMethods` explicitly (it maps each
field by hand). It didn't before — the bug was masked by the old `'{Cash}'` default always
having length ≥1, so onboarding's "at least one method" check passed without a real save.

## Storage & receipts

- Images live in **Supabase Storage** (`receipts` private, `brand` public), not inline data URLs.
  `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never expose it to the browser.
- A payment receipt is **deleted from storage on both approve and reject**. Once verified, the
  payment method + reference are the record. UI must not claim a deleted image is still saved —
  `BookingDetailModal` renders the image only while `hasProof`, then shows "Payment verified".
- Still unmigrated: the brand logo. Drop its data-URL validator and size cap once it moves.

## App structure — three apps, one shared library

The customer site and the admin console are **separate Next.js apps**, deployed to separate
services and hostnames (`demo.` = `apps/web`, `demo-admin.` = `apps/admin`). They share almost
everything through **`libs/web-shared`**:

- `libs/web-shared/src/lib/*` — the store (`store.tsx`, a single unified context serving both
  customer and admin roles), theme, types, dates, pricing, analytics, image, fonts, color, env,
  api-client, errors, google, overrides, cart helpers.
- `libs/web-shared/src/components/*` — the cross-used UI: `Auth` (CustomerLogin / ProfileSetup /
  AdminLogin), `SlotCalendar`, `ui`, `BrandMark`, `Confirm`, `MonthPicker`, `ProofImage`,
  `BookingDetailModal`, `BrandingStyle`.

Both apps reach it via the **`@shared/*`** tsconfig path alias → `libs/web-shared/src/*`. This
works because each app's tsconfig has that path AND drops `rootDir` (so files outside the app's
`src` typecheck); Next compiles the shared source since it's not in `node_modules`. Inside the
shared lib, imports are **relative** (`../lib/theme`), never `@shared`, so the lib doesn't depend
on app-level aliases. Each app's `tailwind.config.js` globs `libs/web-shared/src` too.

- `apps/web` — customer only: `Landing`, `Terms`, `customer/*`. Routes `/` and `/login`.
- `apps/admin` — the console: `components/admin/*`. The console is the **root** (`/`), staff sign
  in at `/login` (email+password → `AdminLogin`, which pushes to `/`). No Google client id needed.
- The store keeps both customer and admin logic in one file on purpose — it's shared, so there's
  one source of truth; the unused half in each app is harmless.

Adding a component used by both apps? It goes in `libs/web-shared/src/components`, imports its deps
relatively, and both apps import it via `@shared/components/...`.

## Web conventions

- Theming is runtime CSS custom properties (`--brand-primary`, `--font-display`, `--font-body`)
  surfaced through `@shared/lib/theme`, so colour and font changes don't touch call sites.
- `SlotCalendar` (in `libs/web-shared`) is the shared week grid — the admin stepper and the
  customer page both consume it so they can't drift. Its `mouseup` listener registers once, so it
  routes through a ref to avoid a stale `commitDrag` closure.
- Settings fields use draft state + explicit Save. Don't PATCH on every keystroke and refetch —
  that clobbers typing.

## Auth

Two doors, deliberately separate:

- **Customers** — Google only. The browser gets an ID token from Google Identity
  Services (`lib/google.ts`), posts it to `POST /auth/google`, and the API verifies
  the signature and `aud` via `GoogleVerifier`. The client never asserts its own
  identity; before this, `/auth/customer-login` trusted the email in the body and
  would mint an **admin** token for anyone who posted the admin address.
- **Admin/staff** — email + password, unchanged.

`upsertGoogleCustomer()` returns null for a non-customer role, which the service
turns into a 401. Keep it that way: verifying the token is not enough on its own,
since someone can legitimately own the admin address at Google.

Accounts match on `google_sub` first, then verified email. That ordering is what
lets a customer change their Gmail address without losing their booking history.
Unverified Google emails are rejected outright.

`GOOGLE_CLIENT_ID` (api) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) must be the same
Web-application client ID. Unset means sign-in returns 503 — this is the one
service that must **not** degrade to a permissive fallback the way `StorageService`
does. No client secret is involved.

E2E can't mint real Google tokens, so `createTestApp()` overrides `GoogleVerifier`
with a stub that decodes `stub:<sub>:<email>:<name>` (see `googleToken()`). Only the
signature check is faked; the role rules and upsert run for real.

## API keys

Machine callers (the MCP server, scripts) authenticate with `pickleball-…` keys
instead of a JWT. `ApiAuthGuard` routes on that prefix and otherwise falls through
to passport JWT, so both kinds of caller hit the same endpoints under the same
`@Roles` rules — a key is exactly as privileged as the admin who created it.

Only the SHA-256 hash is stored; the raw key is returned once at creation. Revoke
is a soft delete, which is what stops `validate()` resolving it.

`ApiKeysModule` is `@Global` because Nest resolves `@UseGuards(ApiAuthGuard)`
through the injector of whichever module uses it — without that, every feature
module would need to import it.

`/api-keys` itself stays on `JwtAuthGuard`: an API key must not be able to mint
more API keys. `auth` and `staff` stay JWT-only for the same reason.

## E2E

Two suites, two databases (`E2E_DB_NAME` / `WEB_E2E_DB_NAME` — separate vars on
purpose; sharing one collapses both onto the same DB and each truncates on start).

`apps/web-e2e` is the browser suite. Spec files are **numbered** and the config
pins `workers: 1, fullyParallel: false`: `01-onboarding` needs an un-onboarded
facility and leaves it provisioned for `02`–`04`. The DB is truncated before the
seed every run (`reset-db.mjs`), so the suite starts production-shaped — the admin
account and nothing else. Specs provision their own fixtures via `support/api.ts`;
that's arrangement only, never the behaviour under test.

Since the admin console split into `apps/admin`, the config runs **three** servers:
API (`:3011`), customer web (`:3010`), and admin (`:3012`). Admin-driving helpers in
`support/ui.ts` navigate to the admin origin via `ADMIN_BASE_URL` (absolute URLs);
customer helpers keep using the default `baseURL`. `CORS_ORIGINS` lists both web
origins. The two apps have separate `localStorage`, so an admin session and a
customer session in one journey spec don't collide — which is correct, they're
different apps.

Google sign-in is stubbed on both sides: the API runs with `GOOGLE_AUTH_STUB=1`
(GoogleVerifier throws at boot if that's ever set with `NODE_ENV=production`), and
`support/google.ts` intercepts the GIS script so the real button, POST and
server-side upsert all still run. Real Google can't be automated.

Do **not** reintroduce `nxE2EPreset` or `@nx/devkit`'s `workspaceRoot` into
`playwright.config.mts`. Importing either pulls in nx's native binding, which
throws "Cannot convert undefined or null to object" under Playwright's ESM loader
and kills the config before any test runs. The preset's defaults are inlined.

Slot cells carry `data-slot="<date>|<hour>"`, `data-slot-state` and
`data-slot-selected`. The grid is mousedown/drag-driven with no roles or
accessible names, so these are the only stable handles — keep them.

## Permissions

A read-only permission allowlist has been drafted for `.claude/settings.json` but not applied;
the auto-mode classifier blocks agent edits to `permissions.allow`, so Ace pastes it manually.
