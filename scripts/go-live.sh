#!/usr/bin/env bash
# One-time go-live for Namdhari Health & Fitness. Needs the Supabase CLI (brew install supabase/tap/supabase).
# Usage:  PROJECT_REF=abcd1234 ./scripts/go-live.sh
set -euo pipefail
: "${PROJECT_REF:?Set PROJECT_REF to your Supabase project ref (Project Settings → General)}"
cd "$(dirname "$0")/.."
[ -f supabase/.secrets.env ] || { echo "Create supabase/.secrets.env first (see README → Secrets)"; exit 1; }

supabase login
supabase link --project-ref "$PROJECT_REF"
supabase db push                                   # creates every table, rule and function
supabase secrets set --env-file supabase/.secrets.env
for f in strava-activity notify-new-challenge send-reminders; do
  supabase functions deploy "$f"
done
echo "✓ Database and server functions are live. Next: README → steps 6–8 (reminder schedule, deploy app, make admins)."
