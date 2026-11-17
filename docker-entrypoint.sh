#!/bin/sh
set -eu
if [ -n "${SUPABASE_DB_DIRECT_URL:-}" ]; then
  DATABASE_URL="$SUPABASE_DB_DIRECT_URL" npx prisma migrate deploy
else
  npx prisma migrate deploy
fi
if [ "${SEED_ON_START:-false}" = "true" ]; then
  npx prisma db seed
fi
exec node dist/main.js
