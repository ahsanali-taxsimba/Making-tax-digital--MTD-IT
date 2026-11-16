#!/bin/sh
set -eu
if [ -n "${SUPABASE_DB_DIRECT_URL:-}" ]; then
  export DATABASE_URL="$SUPABASE_DB_DIRECT_URL"
elif [ -n "${SUPABASE_DB_URL:-}" ]; then
  export DATABASE_URL="$SUPABASE_DB_URL"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Vercel build needs SUPABASE_DB_DIRECT_URL, SUPABASE_DB_URL, or DATABASE_URL" >&2
  exit 1
fi
npx prisma generate
npx prisma migrate deploy
npx nest build
