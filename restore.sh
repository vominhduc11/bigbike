#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────
#  restore.sh — Full-stack restore from a backup produced by backup.sh
#
#  USAGE:
#    ./restore.sh BACKUP_FOLDER
#
#  EXAMPLE:
#    ./restore.sh backups/20260510_020001
#
#  WHAT IT DOES:
#    Phase 1 — Validate backup files and checksums (before touching anything)
#    Phase 2 — Stop backend and minio (prevent writes during restore)
#    Phase 3 — Ensure postgres is running and ready (starts it if needed)
#    Phase 4 — Drop, recreate, and restore the PostgreSQL database
#    Phase 5 — Repair Flyway schema history against current migrations
#    Phase 6 — Wipe and restore the MinIO data volume
#    Phase 7 — Restart minio and backend
#
#  WARNING: Phase 4 permanently replaces all current database data.
#           Run backup.sh first if you want a safety snapshot.
#
#  COMPOSE FILE: uses docker-compose.yaml in the current directory.
# ─────────────────────────────────────────────────────────────────

if [ -z "${1:-}" ]; then
  echo "Usage: ./restore.sh BACKUP_FOLDER"
  echo ""
  echo "Example:"
  echo "  ./restore.sh backups/20260510_020001"
  exit 1
fi

BACKUP_DIR="${1%/}"  # strip any trailing slash

# ─── Load .env ───────────────────────────────────────────────────
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_CONTAINER="postgres"
POSTGRES_DB="${POSTGRES_DB:-bigbike}"
POSTGRES_USER="${POSTGRES_USER:-bigbike}"
FLYWAY_IMAGE="${FLYWAY_IMAGE:-flyway/flyway:10.20.1}"

# ─── Detect MinIO data volume ────────────────────────────────────
if [ -z "${MINIO_VOLUME:-}" ]; then
  MINIO_VOLUME=$(docker volume ls --format '{{.Name}}' | grep '_minio_data$' | head -1)
  if [ -z "$MINIO_VOLUME" ]; then
    echo "ERROR: Could not find a Docker volume matching *_minio_data." >&2
    echo "       Set MINIO_VOLUME explicitly and re-run." >&2
    exit 1
  fi
fi

echo "===================================="
echo "Starting restore from: $BACKUP_DIR"
echo "PostgreSQL DB:  $POSTGRES_DB  (user: $POSTGRES_USER)"
echo "MinIO volume:   $MINIO_VOLUME"
echo "===================================="

# ─── Helper: stop a service only if it is currently running ──────
stop_if_running() {
  local service="$1"
  if docker compose ps "$service" 2>/dev/null | grep -qiE 'up|running'; then
    echo "  Stopping $service..."
    docker compose stop "$service"
  else
    echo "  $service is not running — nothing to stop."
  fi
}

# ─── Helper: ensure a service is running ─────────────────────────
ensure_running() {
  local service="$1"
  if docker compose ps "$service" 2>/dev/null | grep -qiE 'up|running'; then
    echo "  $service is already running."
  else
    echo "  $service is not running — starting it..."
    docker compose up -d "$service"
  fi
}

# ─── Helper: resolve the Docker network of a service ─────────────
get_service_network() {
  local service="$1"
  local container_id
  container_id=$(docker compose ps -q "$service")
  if [ -z "$container_id" ]; then
    echo "ERROR: Could not resolve container id for service: $service" >&2
    return 1
  fi
  docker inspect -f '{{range $name, $cfg := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$container_id" \
    | head -1
}

# ─── Helper: repair Flyway schema history ────────────────────────
repair_flyway_history() {
  local migrations_dir network_name
  migrations_dir="$(cd bigbike-backend/src/main/resources/db/migration && pwd)"
  network_name="$(get_service_network "$POSTGRES_CONTAINER")"

  if [ -z "$network_name" ]; then
    echo "ERROR: Could not determine the Docker network for $POSTGRES_CONTAINER." >&2
    return 1
  fi

  echo "  Repairing Flyway schema history against current migration files..."
  docker run --rm \
    --network "$network_name" \
    -v "$migrations_dir:/flyway/sql:ro" \
    "$FLYWAY_IMAGE" \
    -url="jdbc:postgresql://postgres:5432/$POSTGRES_DB" \
    -user="$POSTGRES_USER" \
    -password="$POSTGRES_PASSWORD" \
    -locations="filesystem:/flyway/sql" \
    repair
}

# ─── Helper: wait for PostgreSQL to accept connections ───────────
wait_for_postgres() {
  local max_wait=60
  local interval=2
  local waited=0

  echo "  Waiting for PostgreSQL to be ready (up to ${max_wait}s)..."
  while [ "$waited" -lt "$max_wait" ]; do
    if docker compose exec -T "$POSTGRES_CONTAINER" \
        pg_isready -U "$POSTGRES_USER" -d postgres -q 2>/dev/null; then
      echo "  PostgreSQL is ready."
      return 0
    fi
    sleep "$interval"
    waited=$((waited + interval))
    echo "  Still waiting... (${waited}s elapsed)"
  done

  echo "" >&2
  echo "ERROR: PostgreSQL did not become ready within ${max_wait}s." >&2
  echo "       Check logs: docker compose logs $POSTGRES_CONTAINER" >&2
  return 1
}

# ═════════════════════════════════════════════════════════════════
# Phase 1 — Pre-flight: validate backup files and checksums
# ═════════════════════════════════════════════════════════════════
echo ""
echo "--- Phase 1: pre-flight checks ---"

PG_ARCHIVE="$BACKUP_DIR/postgres.sql.gz"
MINIO_ARCHIVE="$BACKUP_DIR/minio.tar.gz"

for f in "$PG_ARCHIVE" "$MINIO_ARCHIVE"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: Backup file not found: $f" >&2
    exit 1
  fi
  if [ ! -s "$f" ]; then
    echo "ERROR: Backup file is empty: $f" >&2
    exit 1
  fi
done

for f in "$PG_ARCHIVE" "$MINIO_ARCHIVE"; do
  checksum_file="${f}.sha256"
  if [ -f "$checksum_file" ]; then
    echo "  Verifying checksum: $(basename "$checksum_file")"
    sha256sum --check "$checksum_file"
  else
    echo "  WARNING: No checksum file for $(basename "$f") — skipping integrity check"
  fi
done

BACKUP_ABS=$(cd "$BACKUP_DIR" && pwd)
echo "  Pre-flight checks passed."

# ═════════════════════════════════════════════════════════════════
# Phase 2 — Stop dependent services
# ═════════════════════════════════════════════════════════════════
echo ""
echo "--- Phase 2: stopping dependent services ---"

stop_if_running "bigbike-backend"
stop_if_running "bigbike-web"
stop_if_running "bigbike-admin"
stop_if_running "minio"

if docker compose ps bigbike-backend minio 2>/dev/null | grep -qiE 'up|running'; then
  echo "ERROR: bigbike-backend or minio did not stop cleanly." >&2
  echo "       Aborting to protect live data." >&2
  exit 1
fi

echo "  Dependent services are down."

# ═════════════════════════════════════════════════════════════════
# Phase 3 — Ensure PostgreSQL is running and ready
# ═════════════════════════════════════════════════════════════════
echo ""
echo "--- Phase 3: ensuring PostgreSQL is running ---"

ensure_running "$POSTGRES_CONTAINER"
wait_for_postgres

# ═════════════════════════════════════════════════════════════════
# Phase 4 — Restore PostgreSQL
# ═════════════════════════════════════════════════════════════════
echo ""
echo "--- Phase 4: restoring PostgreSQL ---"

docker compose exec -T "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();" \
  > /dev/null

docker compose exec -T "$POSTGRES_CONTAINER" \
  dropdb --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"

docker compose exec -T "$POSTGRES_CONTAINER" \
  createdb -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "  Streaming backup into PostgreSQL (this may take a while)..."
gunzip -c "$PG_ARCHIVE" \
  | docker compose exec -T "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "  PostgreSQL restore completed."

# ═════════════════════════════════════════════════════════════════
# Phase 5 — Repair Flyway schema history
# ═════════════════════════════════════════════════════════════════
echo ""
echo "--- Phase 5: repairing Flyway schema history ---"

repair_flyway_history

echo "  Flyway schema history repair completed."

# ═════════════════════════════════════════════════════════════════
# Phase 6 — Restore MinIO data volume
# ═════════════════════════════════════════════════════════════════
echo ""
echo "--- Phase 6: restoring MinIO data ---"

docker run --rm \
  -v "$MINIO_VOLUME:/data" \
  -v "$BACKUP_ABS:/backup:ro" \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/minio.tar.gz -C /data"

echo "  MinIO data restore completed."

# ═════════════════════════════════════════════════════════════════
# Phase 7 — Restart services
# ═════════════════════════════════════════════════════════════════
echo ""
echo "--- Phase 7: starting services ---"

docker compose start minio bigbike-backend bigbike-web bigbike-admin

echo ""
echo "Post-restore service status:"
docker compose ps "$POSTGRES_CONTAINER" minio bigbike-backend bigbike-web bigbike-admin

echo ""
echo "===================================="
echo "Restore finished."
echo ""
echo "Next steps:"
echo "  Verify health:  docker compose ps"
echo "  Backend logs:   docker compose logs --tail=50 bigbike-backend"
echo "  MinIO logs:     docker compose logs --tail=20 minio"
echo "===================================="
