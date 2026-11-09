#!/bin/sh
set -e

echo "▶ Aplicando migrations..."
npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "▶ Executando seed de demonstração (idempotente)..."
  node dist/seed.js
fi

exec "$@"
