# AfterHours — Demo Guide

What's ready to show, in what order, and what has to be green first. Built up over the
sessions that took this from prototype to a deployable, real-facility booking system.

## The three surfaces

| URL | What it is | Sign in with |
|-----|------------|--------------|
| `https://demo.bookly-ph.com` | Customer booking app (landing → book) | Google |
| `https://demo-admin.bookly-ph.com` | Facility admin console | Email + password |
| `https://demo-api.bookly-ph.com/api-docs` | API (Swagger) | — |

**Admin login:** `admin@pickleplay.co` / `P@ssw0rd123` (seeded; overridable via `SEED_ADMIN_*`).
Customers sign in with Google only — there is no customer password.

---

## Pre-flight — must all be green before you demo

Nothing degrades gracefully into a good demo; if one of these is off, the relevant screen
breaks in front of the audience. Check them in order.

1. **API is up (not 503).**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://demo-api.bookly-ph.com/api/settings
   ```
   Want `200`. If `503`, check `gcloud app logs tail -s pickleball-api`:
   - `Cannot find module` → a build/deps problem (the express fix is `v1.0.3`).
   - a **database** error → step 2 hasn't been done.

2. **Database is migrated + seeded on Supabase.** The API serves nothing without its schema.
   This is the schema-drop + `npm run migration` + `npm run seed` run — see `docs/DEPLOY-PROD.md`.
   Until it's done, `/api/settings` 503s with a DB error and the whole demo is dead.

3. **Google sign-in works.** The OAuth **Web client** must list `https://demo.bookly-ph.com`
   as an authorized JavaScript origin, and `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
   must be the same id. Test: open the customer app, click **Book now**, confirm the Google
   chooser opens (not a 503). Publish the OAuth consent screen so anyone can sign in, not just
   test users.

4. **The facility is onboarded.** A fresh database has an admin and nothing else — no courts,
   no hours, no payment methods, and onboarding is unfinished (the console is locked until it
   is). Do the onboarding run below **before** the audience is watching, or make it Act 1 of
   the demo on purpose.

5. **(Optional) Supabase Storage keys set.** Without `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`
   the app still runs, but uploaded receipts aren't persisted. Fine to demo without; just don't
   claim receipts are stored if it's unconfigured.

---

## Demo flow

Three acts: set the facility up (admin), book as a customer, approve as admin. ~8–10 minutes.

### Act 1 — Admin onboards the facility  *(demo-admin.bookly-ph.com)*

Sign in as admin. If the facility isn't onboarded yet, a setup wizard blocks the console —
walk through it; it's a good showcase of the white-label story.

1. **Branding** — facility name, logo, primary colour. Change the colour and point out the
   whole console recolours live (runtime CSS variables, not a rebuild).
2. **Hours, courts & pricing** — set opening hours, add a court or two (name, surface, peak /
   off-peak rate). Each court is **editable inline after adding** — click Edit, fix a rate.
3. **Court hours** — tap the grid to mark which hours bill at the peak rate.
4. **Payments** — the strong bit. Add a **GCash** method: it opens a form needing a mobile
   number, and optionally a **QR image**. Add a **Bank transfer**: bank, account number,
   account name, optional QR. Everything is staged in a list you can edit before it's saved.
   This is real per-facility payment config, not a placeholder.
5. **Staff** *(optional)* — add front-desk accounts to a list, then **Create** them all at once;
   each gets a one-time password shown together.
6. **Review & finish** — the console unlocks.

Then show the live console: **Dashboard**, the **week calendar** (drag to select), **Settings**
(same payment editor, branding), **Reports/Sales**.

### Act 2 — Customer books a court  *(demo.bookly-ph.com)*

Open in a separate window/incognito so you're a real customer, not the admin.

1. **Landing page** — the hero photo, customer-first copy, **Book now**. It's the facility's
   brand: name, colour, and the court photo all match Act 1.
2. **Sign in with Google.** First-time accounts fill a short profile (phone) and accept terms.
3. **Pick slots** — the week calendar shows live availability with peak/off-peak pricing per
   slot. Drag across a few hours; the total tallies instantly.
4. **Checkout** — confirm contact, accept terms, and the slots are **held for 10 minutes**
   (a countdown runs). This is the anti-double-booking mechanic — the slots grey out for
   everyone else immediately.
5. **Pay** — the payment methods from Act 1 appear **with their details**: the GCash number,
   the bank account, the **QR to scan** (tap to enlarge). Upload a receipt screenshot.
6. **Submit** — the booking goes to *pending approval*. Show it in **My bookings**.

### Act 3 — Admin approves  *(back to demo-admin.bookly-ph.com)*

1. **Approvals** — the pending booking is waiting, with the uploaded receipt.
2. Record the method used + reference, **Approve**. (Point out the receipt is deleted from
   storage on approve/reject — once verified, the method + reference are the record.)
3. Back on the customer's **My bookings**, the status flips to **confirmed**.

---

## Talking points — what's genuinely strong

- **Real holds, server-enforced.** A 10-minute hold blocks the slot for everyone the instant a
  customer starts paying; expired holds auto-release. Conflicts are rejected server-side (409),
  not just hidden in the UI.
- **Structured, per-facility payments.** GCash/Maya numbers, bank details, and QR codes the
  customer actually sees and scans — configured by the facility, not hardcoded.
- **White-label.** Name, colour, logo, hours, rates, payment methods are all facility config.
  Standing up a second facility is data, not a code change.
- **Two separate apps, one codebase.** Customer app and admin console deploy independently
  (`demo.` vs `demo-admin.`) but share one library, so they can't drift.
- **Auth done right.** Customers are Google-only (the client never asserts its own identity);
  admin/staff are email+password. Different doors on purpose.
- **Prices are frozen at booking time** — changing a rate later never reprices an existing
  booking.

---

## Don't-demo / known gaps

- **Don't skip the pre-flight.** A pre-migration API 503s on every screen.
- **The seeded admin email is `admin@pickleplay.co`** — slightly off-brand for AfterHours.
  Cosmetic; set `SEED_ADMIN_EMAIL` before seeding if it bothers you on screen.
- **Nothing here has been run end-to-end by the build tooling** — the local Postgres blocks
  agent DB access, so the e2e suites and the live flows get their first real exercise when you
  run them. Do a full dry run yourself before a live audience.
- **Sample-login shortcuts are local-only** (`useIsLocal`), so they won't appear on the deployed
  hostnames — good, but it means on the deploy you must use the real admin credentials.
