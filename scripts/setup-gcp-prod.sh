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
API_SVC=pickleball-api
WEB_SVC=pickleball-web
CB_DIR=production

# Secret-name prefix. Deliberately the short project name, not $PROJECT_ID —
# it must match the `availableSecrets` block already committed in
# cloudbuild/production/cloudbuild-api.yaml.
SEC=pickleball-

# Public hostnames (see dispatch.yaml).
API_HOST=demo-api.bookly-ph.com
WEB_HOST=demo-customer.bookly-ph.com
ADMIN_HOST=demo-admin.bookly-ph.com

say () { printf '\n\033[1;32m==> %s\033[0m\n' "$1"; }

gcloud config set project "$PROJECT_ID"

# ------------------------------------------------------- Phase A — enable APIs
say "Phase A — enabling APIs"
gcloud services enable \
  appengine.googleapis.com cloudbuild.googleapis.com \
  secretmanager.googleapis.com iam.googleapis.com cloudresourcemanager.googleapis.com

# ----------------------------------------------- Phase B — App Engine bootstrap
say "Phase B — App Engine app + default service"
gcloud app describe >/dev/null 2>&1 || gcloud app create --region="$REGION"

# App Engine's first deploy in a fresh project MUST be the service literally
# named `default`, and no other service can deploy until it exists. Neither of
# our real services is called that, so deploy a throwaway stub to claim the
# slot. It also becomes the fallback for any hostname dispatch.yaml misses.
if ! gcloud app services describe default >/dev/null 2>&1; then
  TMP="$(mktemp -d)"
  cat > "$TMP/app.yaml" <<'YAML'
runtime: nodejs22
service: default
handlers:
  - url: /.*
    script: auto
    secure: always
YAML
  cat > "$TMP/index.js" <<'JS'
require('http').createServer((_, r) => r.end('default ok')).listen(process.env.PORT || 8080);
JS
  cat > "$TMP/package.json" <<'JSON'
{ "name": "ae-default", "main": "index.js", "scripts": { "start": "node index.js" } }
JSON
  ( cd "$TMP" && gcloud app deploy app.yaml --quiet )
else
  echo "  default service already exists — skipping bootstrap."
fi

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

echo "  Supabase: use the SESSION POOLER host (IPv4). App Engine standard has no"
echo "  IPv6 outbound, and db.<ref>.supabase.co is IPv6-only — it will hang."
echo "  Pooler looks like: aws-0-<region>.pooler.supabase.com / user postgres.<ref>"
echo

read -rsp "  JWT_SECRET (hidden, long random string): " V_JWT; echo
create_secret "${SEC}jwt-secret" "$V_JWT"

read -rsp "  DB_PASSWORD (hidden): " V_DBPW; echo
create_secret "${SEC}db-password" "$V_DBPW"

read -rp  "  DB_HOST: "                  V_DBH; create_secret "${SEC}db-host"     "$V_DBH"
read -rp  "  DB_PORT [5432]: "           V_DBP; create_secret "${SEC}db-port"     "${V_DBP:-5432}"
read -rp  "  DB_USERNAME: "              V_DBU; create_secret "${SEC}db-username" "$V_DBU"

# ------------------------------------------------- Phase E — Cloud Build triggers
say "Phase E — Cloud Build triggers"
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

# Non-sensitive config only — mirrors apps/api/.env.example. CORS carries BOTH
# browser hostnames: the console and the customer app are one deployable but
# reach the API from two different origins.
API_SUBS="_GCP_PROJECT_ID=${PROJECT_ID}"
API_SUBS="${API_SUBS},_NODE_ENV=production,_PORT=8080"
API_SUBS="${API_SUBS},_DB_NAME=postgres"
API_SUBS="${API_SUBS},_DB_SYNCHRONIZE=false,_DB_LOGGING=false,_DB_SSL=true"
API_SUBS="${API_SUBS},_JWT_EXPIRES_IN=7d,_BCRYPT_ROUNDS=10"
API_SUBS="${API_SUBS},_CORS_ORIGINS=https://${WEB_HOST}\\,https://${ADMIN_HOST}"
API_SUBS="${API_SUBS},_THROTTLE_TTL=60,_THROTTLE_LIMIT=100"

# NEXT_PUBLIC_* are inlined at BUILD time — middleware.ts runs in the Edge
# runtime and reads them from the bundle, not from App Engine env_variables.
WEB_SUBS="_GCP_PROJECT_ID=${PROJECT_ID}"
WEB_SUBS="${WEB_SUBS},_NEXT_PUBLIC_API_BASE_URL=https://${API_HOST}/api"
WEB_SUBS="${WEB_SUBS},_NEXT_PUBLIC_ADMIN_HOST=${ADMIN_HOST}"
WEB_SUBS="${WEB_SUBS},_NEXT_PUBLIC_CUSTOMER_HOST=${WEB_HOST}"

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

create_trigger "$API_SVC" "cloudbuild/${CB_DIR}/cloudbuild-api.yaml" "$API_SUBS"
create_trigger "$WEB_SVC" "cloudbuild/${CB_DIR}/cloudbuild-web.yaml" "$WEB_SUBS"

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

Deploy by cutting a GitHub Release — that publishes the v* tag both triggers
fire on:

  gh release create v1.0.0 --generate-notes

Finally, once both services exist, publish the hostname routing:

  gcloud app deploy dispatch.yaml --project=${PROJECT_ID}

EOF
