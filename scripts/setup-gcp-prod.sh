#!/usr/bin/env bash
#
# One-time GCP setup for the pickleball-system PRODUCTION deployment.
#
# Idempotent: safe to re-run. Every create is guarded by a describe/list check,
# so a second run only adds secret versions you re-enter.
#
# PREREQUISITES (yours, not this script's):
#   1. GCP project created and billing assigned.
#   2. `gcloud auth login` done.
#   3. GitHub repo connected in the Cloud Build console (Repositories → Connect).
#      That is an OAuth handshake and cannot be scripted. Note the CONNECTION
#      NAME you type on that screen — this script asks for it.
#
# Usage:  ./scripts/setup-gcp-prod.sh
#
set -euo pipefail

# ---------------------------------------------------------------- constants --
export REGION=asia-southeast1              # permanent, closest to PH
export GH_OWNER=aceshiryu
export GH_REPO=pickleball-system
export PROJECT_ID=pickleball-system-502915
export APPSPOT_SA="${PROJECT_ID}@appspot.gserviceaccount.com"
export TAG_PATTERN='^v.*$'                 # the v* tag a GitHub Release publishes

# PROD = no suffix anywhere (never -prod / -production).
# The customer web app occupies the `default` slot; api and admin are named.
API_SVC=pickleball-api
WEB_SVC=default
ADMIN_SVC=pickleball-admin
CB_DIR=production

# Secret-name prefix. Deliberately the short project name, not $PROJECT_ID —
# it must match the `availableSecrets` block already committed in
# cloudbuild/production/cloudbuild-api.yaml.
SEC=pickleball-

# Public hostnames (see dispatch.yaml).
API_HOST=demo-api.bookly-ph.com
WEB_HOST=demo.bookly-ph.com
ADMIN_HOST=demo-admin.bookly-ph.com

say () { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

gcloud config set project "$PROJECT_ID"

# ------------------------------------------------------- Phase A — enable APIs
say "Phase A — enabling APIs"
gcloud services enable \
  appengine.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com

# ----------------------------------------------- Phase B — App Engine bootstrap
say "Phase B — App Engine app"
gcloud app describe >/dev/null 2>&1 || gcloud app create --region="$REGION"

# No stub bootstrap needed: apps/web/app.yaml declares `service: default`, so
# the customer app itself claims the slot. It MUST therefore be the first
# service deployed in a fresh project — App Engine refuses to deploy any other
# service until `default` exists. The release cuts all three triggers at once,
# so if the very first release fails on api or admin with a "default service
# does not exist" error, deploy web once by hand and re-release:
#
#   gcloud builds submit --config=cloudbuild/production/cloudbuild-web.yaml \
#     --substitutions="_GCP_PROJECT_ID=${PROJECT_ID},_NEXT_PUBLIC_API_BASE_URL=https://${API_HOST}/api"

# --------------------------------------------------------------- Phase C — IAM
# Cloud Build runs as the App Engine default SA. Project-level, so this covers
# every environment and only needs doing once.
#
# NOTE: run this yourself if it fails under an agent — IAM policy changes are
# commonly blocked in sandboxed shells.
say "Phase C — IAM roles on ${APPSPOT_SA}"
for ROLE in \
  roles/appengine.deployer roles/appengine.serviceAdmin \
  roles/cloudbuild.builds.builder roles/iam.serviceAccountUser \
  roles/secretmanager.secretAccessor roles/logging.logWriter roles/storage.admin ; do
  echo "  binding $ROLE"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${APPSPOT_SA}" --role="$ROLE" --condition=None >/dev/null
done

# ---------------------------------------------------- Phase D — Secret Manager
# You supply every value; nothing is generated for you.
#
# DB_NAME is NOT here on purpose. Deployed environments share one Supabase
# project where the database is always `postgres`, so the value is identical
# everywhere and secret-worthy of nothing. It is a plain `_DB_NAME` substitution
# in cloudbuild/production/cloudbuild-api.yaml instead.
#
# Re-running a later phase after a failure? Skip re-entering all six values with:
#   SKIP_SECRETS=1 ./scripts/setup-gcp-prod.sh
say "Phase D — Secret Manager"

create_secret () {  # $1=name  $2=value
  if gcloud secrets describe "$1" >/dev/null 2>&1; then
    printf '%s' "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
    echo "  updated $1"
  else
    printf '%s' "$2" | gcloud secrets create "$1" --data-file=- >/dev/null
    echo "  created $1"
  fi
}

if [ "${SKIP_SECRETS:-}" = "1" ]; then
  echo "  SKIP_SECRETS=1 — leaving existing secret versions untouched."
else
  echo "  Supabase: use the SESSION POOLER host (IPv4). App Engine standard has no"
  echo "  IPv6 outbound, and db.<ref>.supabase.co is IPv6-only — it will hang."
  echo "  Pooler looks like: aws-0-<region>.pooler.supabase.com / user postgres.<ref>"
  echo

  read -rsp "  JWT_SECRET (hidden, long random string): " V_JWT; echo
  create_secret "${SEC}jwt-secret" "$V_JWT"

  read -rsp "  DB_PASSWORD (hidden): " V_DBPW; echo
  create_secret "${SEC}db-password" "$V_DBPW"

  read -rsp "  SUPABASE_SERVICE_ROLE_KEY (hidden — server-side only, never in a NEXT_PUBLIC_ var): " V_SRK; echo
  create_secret "${SEC}supabase-service-role-key" "$V_SRK"

  read -rp  "  DB_HOST: "                  V_DBH; create_secret "${SEC}db-host"     "$V_DBH"
  read -rp  "  DB_PORT [5432]: "           V_DBP; create_secret "${SEC}db-port"     "${V_DBP:-5432}"
  read -rp  "  DB_USERNAME: "              V_DBU; create_secret "${SEC}db-username" "$V_DBU"
fi

# ------------------------------------------------- Phase E — Cloud Build triggers
say "Phase E — Cloud Build triggers"

# Non-sensitive, but they differ per project so they can't be hardcoded. The
# SAME Google client ID goes to both the API (which verifies the token) and the
# web build (which requests it) — a mismatch fails every sign-in with a 401.
read -rp "  GOOGLE_CLIENT_ID (OAuth 2.0 *Web application* client ID): " V_GID
read -rp "  SUPABASE_URL (https://<ref>.supabase.co): "                 V_SURL
read -rp "  Cloud Build connection name (from the console Connect screen): " CONN

if ! gcloud builds repositories describe "$GH_REPO" \
      --connection="$CONN" --region="$REGION" >/dev/null 2>&1; then
  gcloud builds repositories create "$GH_REPO" \
    --connection="$CONN" --region="$REGION" \
    --remote-uri="https://github.com/${GH_OWNER}/${GH_REPO}.git"
else
  echo "  repository already linked."
fi

REPO="projects/${PROJECT_ID}/locations/${REGION}/connections/${CONN}/repositories/${GH_REPO}"

# Non-sensitive config only — mirrors apps/api/.env.example.
#
# The leading `^;^` switches gcloud's dict parser from comma to semicolon as the
# pair separator. CORS_ORIGINS is itself a comma-separated list, and with the
# default separator gcloud splits mid-value and fails with
# "Bad syntax for dict arg". Backslash-escaping the comma does NOT work here.
API_SUBS="^;^_GCP_PROJECT_ID=${PROJECT_ID}"
API_SUBS="${API_SUBS};_NODE_ENV=production;_PORT=8080"
API_SUBS="${API_SUBS};_DB_NAME=postgres"
API_SUBS="${API_SUBS};_DB_SYNCHRONIZE=false;_DB_LOGGING=false;_DB_SSL=true"
API_SUBS="${API_SUBS};_JWT_EXPIRES_IN=7d;_BCRYPT_ROUNDS=10"
API_SUBS="${API_SUBS};_CORS_ORIGINS=https://${WEB_HOST},https://${ADMIN_HOST}"
API_SUBS="${API_SUBS};_THROTTLE_TTL=60;_THROTTLE_LIMIT=100"
API_SUBS="${API_SUBS};_GOOGLE_CLIENT_ID=${V_GID}"
API_SUBS="${API_SUBS};_SUPABASE_URL=${V_SURL}"
API_SUBS="${API_SUBS};_SUPABASE_RECEIPTS_BUCKET=receipts;_SUPABASE_PUBLIC_BUCKET=brand"

# NEXT_PUBLIC_* is inlined at BUILD time by Next, so it comes from the trigger
# substitution rather than App Engine env_variables.
WEB_SUBS="_GCP_PROJECT_ID=${PROJECT_ID}"
WEB_SUBS="${WEB_SUBS},_NEXT_PUBLIC_API_BASE_URL=https://${API_HOST}/api"
WEB_SUBS="${WEB_SUBS},_NEXT_PUBLIC_GOOGLE_CLIENT_ID=${V_GID}"

ADMIN_SUBS="_GCP_PROJECT_ID=${PROJECT_ID}"
ADMIN_SUBS="${ADMIN_SUBS},_NEXT_PUBLIC_API_BASE_URL=https://${API_HOST}/api"

# No --included-files on tag triggers: on a tag push Cloud Build diffs against
# the parent commit, so a release touching only apps/api would silently skip web.
create_trigger () {  # $1=name  $2=build-config  $3=substitutions
  if gcloud builds triggers describe "$1" --region="$REGION" >/dev/null 2>&1; then
    echo "  trigger $1 already exists — skipping."
    return
  fi
  gcloud builds triggers create github \
    --name="$1" --region="$REGION" \
    --repository="$REPO" --tag-pattern="$TAG_PATTERN" \
    --build-config="$2" \
    --service-account="projects/${PROJECT_ID}/serviceAccounts/${APPSPOT_SA}" \
    --substitutions="$3"
  echo "  created trigger $1"
}

create_trigger "$API_SVC"        "cloudbuild/${CB_DIR}/cloudbuild-api.yaml"   "$API_SUBS"
# Trigger name, not service name: `default` is a poor trigger label and would
# collide conceptually with other projects in the same Cloud Build region.
create_trigger "pickleball-web"  "cloudbuild/${CB_DIR}/cloudbuild-web.yaml"   "$WEB_SUBS"
create_trigger "$ADMIN_SVC"      "cloudbuild/${CB_DIR}/cloudbuild-admin.yaml" "$ADMIN_SUBS"

# ------------------------------------------------------------------- next steps
cat <<EOF

$(say "Setup complete")

BEFORE the first deploy — the API boots, connects, and runs NO migrations, so an
empty database means the version fails its health check and never serves:

  1. Point apps/api/.env at the Supabase pooler host with DB_SSL=true
  2. npx nx run api:migration-run
  3. npx nx run api:seed-run          # creates the single admin account

Then map the custom domains (each prints DNS records to add at your registrar):

  gcloud app domain-mappings create ${WEB_HOST}   --project=${PROJECT_ID}
  gcloud app domain-mappings create ${ADMIN_HOST} --project=${PROJECT_ID}
  gcloud app domain-mappings create ${API_HOST}   --project=${PROJECT_ID}

Deploy by cutting a GitHub Release — that publishes the v* tag all three
triggers fire on:

  gh release create v1.0.0 --generate-notes

On a FRESH project the three builds race, and api/admin will fail if they reach
App Engine before web has created the \`default\` service. If that happens,
deploy web once by hand and re-release:

  gcloud builds submit --config=cloudbuild/${CB_DIR}/cloudbuild-web.yaml \\
    --substitutions="_GCP_PROJECT_ID=${PROJECT_ID},_NEXT_PUBLIC_API_BASE_URL=https://${API_HOST}/api"

Finally, once all three services exist, publish the hostname routing:

  gcloud app deploy dispatch.yaml --project=${PROJECT_ID}

EOF
