#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR/infra/hetzner"

if [[ ! -f ./env/server.env ]]; then
  echo "Missing infra/hetzner/env/server.env"
  exit 1
fi

set -a
source ./env/server.env
set +a

docker compose --env-file ./env/server.env up -d --build
cat "$ROOT_DIR/database/control-schema.sql" | docker exec -i skyedb-postgres psql -U "$POSTGRES_SUPERUSER" -d "$CONTROL_DB_NAME"

echo "SkyeDB Hetzner base stack is up."
