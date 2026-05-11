#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="./backups"
BACKUP_DIR="$BACKUP_ROOT/$DATE"

# Load .env if present so POSTGRES_DB / POSTGRES_USER / POSTGRES_PASSWORD
# are picked up automatically without hardcoding them here.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_CONTAINER="postgres"
POSTGRES_DB="${POSTGRES_DB:-bigbike}"
POSTGRES_USER="${POSTGRES_USER:-bigbike}"

# Detect MinIO data volume dynamically so the script survives project renames.
# Override by setting MINIO_VOLUME in the environment or .env file.
if [ -z "${MINIO_VOLUME:-}" ]; then
  MINIO_VOLUME=$(docker volume ls --format '{{.Name}}' | grep '_minio_data$' | head -1)
  if [ -z "$MINIO_VOLUME" ]; then
    echo "ERROR: Could not find a Docker volume matching *_minio_data." >&2
    echo "       Set MINIO_VOLUME explicitly and re-run." >&2
    exit 1
  fi
fi

RETENTION_DAYS="${RETENTION_DAYS:-7}"

echo "===================================="
echo "Starting backup: $DATE"
echo "PostgreSQL DB:   $POSTGRES_DB  (user: $POSTGRES_USER)"
echo "MinIO volume:    $MINIO_VOLUME"
echo "===================================="

# Pre-flight: PostgreSQL container must be running.
if ! docker compose ps "$POSTGRES_CONTAINER" | grep -qiE 'up|running'; then
  echo "ERROR: PostgreSQL container '$POSTGRES_CONTAINER' is not running." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

#################################
# PostgreSQL Backup
#################################

echo "Backing up PostgreSQL..."

docker compose exec -T "$POSTGRES_CONTAINER" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --no-owner --no-privileges \
  | gzip > "$BACKUP_DIR/postgres.sql.gz"

if [ ! -s "$BACKUP_DIR/postgres.sql.gz" ]; then
  echo "ERROR: PostgreSQL backup file is empty — aborting." >&2
  exit 1
fi

sha256sum "$BACKUP_DIR/postgres.sql.gz" > "$BACKUP_DIR/postgres.sql.gz.sha256"
echo "PostgreSQL backup completed ($(du -h "$BACKUP_DIR/postgres.sql.gz" | cut -f1))"

#################################
# MinIO Backup
#################################

echo "Backing up MinIO..."

docker run --rm \
  -v "$MINIO_VOLUME:/data:ro" \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  alpine \
  tar czf /backup/minio.tar.gz -C /data .

if [ ! -s "$BACKUP_DIR/minio.tar.gz" ]; then
  echo "ERROR: MinIO backup file is empty — aborting." >&2
  exit 1
fi

sha256sum "$BACKUP_DIR/minio.tar.gz" > "$BACKUP_DIR/minio.tar.gz.sha256"
echo "MinIO backup completed ($(du -h "$BACKUP_DIR/minio.tar.gz" | cut -f1))"

#################################
# Cleanup old backups
#################################

echo "Cleaning backups older than $RETENTION_DAYS days..."

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} \;

echo "Cleanup completed"

echo "===================================="
echo "Backup finished successfully"
echo "Location: $BACKUP_DIR"
echo "===================================="
