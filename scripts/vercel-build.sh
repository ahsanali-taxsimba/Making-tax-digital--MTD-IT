#!/bin/sh
set -eu
if [ -n "${SUPABASE_DB_DIRECT_URL:-}" ]; then
  export DATABASE_URL="$SUPABASE_DB_DIRECT_URL"
elif [ -n "${SUPABASE_DB_URL:-}" ]; then
  export DATABASE_URL="$SUPABASE_DB_URL"
fi
if [ -z "${DATABASE_URL:-}" ]; then
  export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/postgres"
  SKIP_MIGRATE=1
fi
npx prisma generate
if [ "${SKIP_MIGRATE:-}" = "1" ]; then
  echo "Skipping prisma migrate deploy (no Supabase URL on this build)"
else
  npx prisma migrate deploy
  if [ "${SEED_ON_START:-}" = "true" ]; then
    echo "Seeding demo practice users"
    npx prisma db seed
  fi
fi
npx nest build
