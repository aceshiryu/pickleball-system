# Deploy — Production

The production deployment of pickleball-system on GCP App Engine, built by Cloud Build,
with credentials in Secret Manager.

| | |
|---|---|
| GCP project | `pickleball-system-502915` |
| Region | `asia-southeast1` (permanent) |
| GitHub | `aceshiryu/pickleball-system` |
| Services | `default` (web), `pickleball-api`, `pickleball-admin` |
| Build configs | `cloudbuild/production/` |
| Deploy action | publish a GitHub Release (`v*` tag) |

PROD carries **no name suffix** — never `-prod` or `-production`.

## Hostnames

| Hostname | Service | Descriptor | Serves |
|---|---|---|---|
| `demo.bookly-ph.com` | `default` | `apps/web/app.yaml` | customer app **and** the real admin console at `/admin` |
| `demo-admin.bookly-ph.com` | `pickleball-admin` | `apps/admin/app.yaml` | `apps/admin` — see the warning below |
| `demo-api.bookly-ph.com` | `pickleball-api` | `apps/api/app.yaml` | NestJS under `/api`, Swagger at `/api-docs` |
| anything else | `default` | | customer app |

> **`demo-admin` does not serve the admin console.** `apps/admin` is the project generator's
> todo scaffold, deployed to prove the pipeline end to end. Its only screen calls the `/todos`
> endpoints, which were removed from the API — the page loads and then reports a load failure.
>
> The real console is a route inside the customer web app, reachable at
> **`demo.bookly-ph.com/admin`**. Moving it onto its own hostname means either
> deploying the web bundle a second time under the admin service, or porting the console into
> `apps/admin` behind a shared component lib.

`default` must be the **first** service deployed in a fresh project — App Engine refuses every
other service until it exists. Since `apps/web/app.yaml` claims that slot, web goes first.

## Running it

```bash
./scripts/setup-gcp-prod.sh
```

Idempotent — every create is guarded, so re-running is safe. If you're re-running after a
failure in a later phase and don't want to re-type all six secret values:

```bash
SKIP_SECRETS=1 ./scripts/setup-gcp-prod.sh
```

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
`pickleball-db-port`, `pickleball-db-username`, `pickleball-supabase-service-role-key`

**Cloud Build substitutions** (non-sensitive, plaintext in the trigger):

`_NODE_ENV`, `_PORT`, `_DB_NAME`, `_DB_SYNCHRONIZE`, `_DB_LOGGING`, `_DB_SSL`,
`_JWT_EXPIRES_IN`, `_BCRYPT_ROUNDS`, `_CORS_ORIGINS`, `_THROTTLE_TTL`, `_THROTTLE_LIMIT`,
`_GOOGLE_CLIENT_ID`, `_SUPABASE_URL`, `_SUPABASE_RECEIPTS_BUCKET`, `_SUPABASE_PUBLIC_BUCKET`,
and web/admin's `_NEXT_PUBLIC_API_BASE_URL` / `_NEXT_PUBLIC_GOOGLE_CLIENT_ID`

The Supabase **service-role key** is the only sensitive Supabase value — the project URL and
bucket names are not. It is server-side only and must never appear in a `NEXT_PUBLIC_` var.

`GOOGLE_CLIENT_ID` (api) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) must be the **same** OAuth
Web application client ID: the browser requests a token for it and the API verifies the token
was minted for it. A mismatch fails every sign-in with a 401. Both demo hostnames must also be
authorized JavaScript origins on that client.

### Two deliberate deviations from the standard split

**`DB_NAME` is a substitution, not a secret.** Deployed environments share one Supabase project,
where the database is always called `postgres` — the value is identical everywhere and identifies
nothing on its own. Keeping it in Secret Manager bought no secrecy and added a secret to
provision per environment.

**`NEXT_PUBLIC_API_BASE_URL` comes from the trigger substitution, not `app.yaml`.** Next inlines
`NEXT_PUBLIC_*` at build time, so an App Engine `env_variables` entry would arrive too late to
affect the bundle.

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
gcloud app domain-mappings create demo.bookly-ph.com       --project=pickleball-system-502915
gcloud app domain-mappings create demo-admin.bookly-ph.com --project=pickleball-system-502915
gcloud app domain-mappings create demo-api.bookly-ph.com   --project=pickleball-system-502915
```

Until the mappings and DNS exist, the `dispatch.yaml` rules match nothing.

## Deploying

Deploys are **release-driven**. Cutting a release publishes the `v*` tag all three triggers
fire on:

```bash
gh release create v1.0.0 --generate-notes
```

On a **fresh** project the three builds race, and api/admin will fail if they reach App Engine
before web has created `default`. If that happens, deploy web once by hand and re-release:

```bash
gcloud builds submit --config=cloudbuild/production/cloudbuild-web.yaml \
  --substitutions="_GCP_PROJECT_ID=pickleball-system-502915,_NEXT_PUBLIC_API_BASE_URL=https://demo-api.bookly-ph.com/api"
```

Then, once all three services exist, publish the routing:

```bash
gcloud app deploy dispatch.yaml --project=pickleball-system-502915
```

Order matters — dispatch rules pointing at a service that doesn't exist yet will fail.

## Behaviour when optional config is missing

- **Google sign-in** returns **503** if `GOOGLE_CLIENT_ID` is empty. This is deliberate — it is
  the one service that must not degrade to a permissive fallback, because a fallback would mean
  accepting unverified identities.
- **Supabase Storage** disables itself if `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are
  empty. The app still runs; payment receipts just aren't persisted.

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
| `--substitutions: Bad syntax for dict arg` | a substitution *value* contains a comma (here, `_CORS_ORIGINS`). gcloud splits pairs on commas and backslash-escaping does **not** help — prefix the whole string with `^;^` to switch the separator to `;`, which is what the script does |
