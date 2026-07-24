#!/usr/bin/env bash
# Sync local Supabase env → Vercel project that serves nala-ai-iota.
# Prerequisite: `npx vercel login` dengan akun yang punya project nala-ai
# (team: mahendraagungprayogga1144-bots-projects), lalu link project.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing .env.local"
  exit 1
fi

# shellcheck disable=SC1090
set -a
# parse KEY=VAL lines
eval "$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=|^NEXT_PUBLIC_SUPABASE_ANON_KEY=|^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | sed 's/\r$//')"
set +a

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL:-}" || -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY wajib ada di .env.local"
  exit 1
fi

echo "Target Supabase host: ${NEXT_PUBLIC_SUPABASE_URL}"
echo "Linking/using current Vercel project…"
npx vercel whoami

upsert() {
  local name="$1" value="$2"
  # Remove existing then add for production + preview
  npx vercel env rm "$name" production --yes 2>/dev/null || true
  npx vercel env rm "$name" preview --yes 2>/dev/null || true
  printf '%s' "$value" | npx vercel env add "$name" production
  printf '%s' "$value" | npx vercel env add "$name" preview
}

upsert NEXT_PUBLIC_SUPABASE_URL "$NEXT_PUBLIC_SUPABASE_URL"
upsert NEXT_PUBLIC_SUPABASE_ANON_KEY "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  upsert SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
else
  echo "WARN: SUPABASE_SERVICE_ROLE_KEY belum ada di .env.local — register admin akan gagal sampai diisi."
fi

echo "Redeploying production…"
npx vercel --prod --yes

echo "Done. Test: https://nala-ai-iota.vercel.app/login (daftar/masuk akun nyata)."
