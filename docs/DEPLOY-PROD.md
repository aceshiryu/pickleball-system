# Deploy — Production

The production deployment of pickleball-system on GCP App Engine, built by Cloud Build,
with credentials in Secret Manager.

| | |
|---|---|
| GCP project | `pickleball-system-502915` |
| Region | `asia-southeast1` (permanent) |
| GitHub | `aceshiryu/pickleball-system` |
| Services | `pickleball-api`, `pickleball-web`, plus a `default` bootstrap stub |
| Build configs | `cloudbuild/production/` |
| Deploy action | publish a GitHub Release (`v*` tag) |

PROD carries **no name suffix** — never `-prod` or `-production`.

## Hostnames

| Hostname | Service | Serves |
|---|---|---|
| `demo-customer.bookly-ph.com` | `pickleball-web` | customer app; `/admin` is refused |
| `demo-admin.bookly-ph.com` | `pickleball-web` | admin console; `/` redirects to `/admin` |
| `demo-api.bookly-ph.com` | `pickleball-api` | NestJS under `/api`, Swagger at `/api-docs` |
| anything else | `default` | bootstrap stub |

The customer app and the admin console are **one deployable** — the console is a route inside
the Next.js app, not a separate service. `dispatch.yaml` can only map a hostname to a service,
so the split between the two browser hostnames is enforced in `apps/web/src/middleware.ts`.

## Running it

```bash
./scripts/setup-gcp-prod.sh
```

Idempotent — every create is guarded, so re-running only adds secret versions you re-enter.

### Before you run it

1. **Create the GCP project and assign billing.**
2. **`gcloud auth login`.**
3. **Connect the GitHub repo in the Cloud Build console** (Repositories → Connect). This is an
   OAuth handshake and cannot be scripted. Note the *connection name* you type — the script
   asks for it.

If the IAM phase fails, run that loop yourself; IAM policy changes are often blocked in
sandboxed shells.

## What is a secret and what isn't

**Secret Manager** (injected via `availableSecrets` → `secretEnv`, landing in the deployed
`.env` through the `create-env` step):

`pickleball-jwt-secret`, `pickleball-db-password`, `pickleball-db-host`,
`pickleball-db-port`, `pickleball-db-username`

**Cloud Build substitutions** (non-sensitive, plaintext in the trigger):

`_NODE_ENV`, `_PORT`, `_DB_NAME`, `_DB_SYNCHRONIZE`, `_DB_LOGGING`, `_DB_SSL`,
`_JWT_EXPIRES_IN`, `_BCRYPT_ROUNDS`, `_CORS_ORIGINS`, `_THROTTLE_TTL`, `_THROTTLE_LIMIT`,
and web's `_NEXT_PUBLIC_*`

### Two deliberate deviations from the standard split

**`DB_NAME` is a substitution, not a secret.** Deployed environments share one Supabase project,
where the database is always called `postgres` — the value is identical everywhere and identifies
nothing on its own. Keeping it in Secret Manager bought no secrecy and added a secret to
provision per environment.

**`NEXT_PUBLIC_ADMIN_HOST` / `NEXT_PUBLIC_CUSTOMER_HOST` are set at build time**, in the web
build step rather than in `app.yaml`. `middleware.ts` runs in the Edge runtime, where
`NEXT_PUBLIC_*` values are inlined during the build; supplying them as App Engine
`env_variables` would leave them undefined at request time and the hostname split would
silently stop working.

## Database preflight — do this before the first deploy

The API connects on boot and runs **no** migrations. Against an empty database the version fails
its health check and never serves — a green build that doesn't work.

```bash
# apps/api/.env → Supabase session pooler host, DB_SSL=true
npx nx run api:migration-run
npx nx run api:seed-run          # single admin account
```

**Supabase host:** use the **session pooler** (IPv4) from the dashboard's Connect tab —
`aws-0-<region>.pooler.supabase.com`, port `5432`, user `postgres.<project-ref>`, database
`postgres`. App Engine standard has no IPv6 outbound and the direct `db.<ref>.supabase.co` host
is IPv6-only, so it will simply hang.

## Custom domains

Map each hostname, then add the DNS records Google returns at your registrar:

```bash
gcloud app domain-mappings create demo-customer.bookly-ph.com --project=pickleball-system-502915
gcloud app domain-mappings create demo-admin.bookly-ph.com    --project=pickleball-system-502915
gcloud app domain-mappings create demo-api.bookly-ph.com      --project=pickleball-system-502915
```

Until the mappings and DNS exist, the `dispatch.yaml` rules match nothing.

## Deploying

Deploys are **release-driven**. Cutting a release publishes the `v*` tag both triggers fire on:

```bash
gh release create v1.0.0 --generate-notes
```

Then, once both services exist, publish the routing:

```bash
gcloud app deploy dispatch.yaml --project=pickleball-system-502915
```

Order matters — dispatch rules pointing at a service that doesn't exist yet will fail.

## Also required for a working demo

- **`GOOGLE_CLIENT_ID`** is not yet wired into the API cloudbuild. Unset, customer sign-in
  returns 503 by design (it does not degrade to a permissive fallback). You also need both
  browser hostnames registered as authorized JavaScript origins on the OAuth client.
- **`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`** are likewise unwired. Without them
  `StorageService` disables itself and payment receipts are not persisted.

## Troubleshooting

```bash
gcloud builds triggers list --region=asia-southeast1   # 2nd-gen triggers are regional
gcloud builds list --limit=5 --region=asia-southeast1
gcloud app logs tail -s pickleball-api                 # build green but not serving?
                                                       # almost always DB connect: SSL, pooler, or schema
```

| Symptom | Cause |
|---|---|
| `npm ci` EUSAGE, lock file out of sync | stale `package-lock.json` in the tagged commit — `npm install`, commit the lock, re-tag |
| only one service deployed after a tag | an `--included-files` filter on the trigger; remove it |
| `Cannot find module '/workspace/server.js'` | `app.yaml` missing `entrypoint` (api → `node main.js`, web → `node apps/web/server.js`) |
| web crashes at `require('next')` | `.next` not uploaded — missing `.gcloudignore` in the standalone deploy dir |
| a shell var came through empty in a build step | inline `bash -c` used `$FOO` where Cloud Build ate it as a substitution; double it to `$$FOO` |
