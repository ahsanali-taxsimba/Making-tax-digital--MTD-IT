#!/bin/sh
set -eu
npx prisma migrate deploy
if [ "${ALLOW_DB_SEED:-false}" = "true" ] || [ "${NODE_ENV:-development}" != "production" ]; then
  if [ "${SKIP_DB_SEED:-false}" != "true" ]; then
    npx prisma db seed
  fi
fi
exec node dist/main.js
