#!/usr/bin/env bash
# PostgreSQL backup script for BigBike production.
# Usage: ./pg_backup.sh
# Environment variables (override via .env or secret manager):
#   POSTGRES_HOST     default: localhost
#   POSTGRES_PORT     default: 5432
#   POSTGRES_DB       default: bigbike
#   POSTGRES_USER     default: bigbike
#   PGPASSWORD        required: database password
#   BACKUP_DIR        default: /var/backups/bigbike
#   BACKUP_RETAIN_DAYS default: 14
set -euo pipefail

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-bigbike}"
POSTGRES_USER="${POSTGRES_USER:-bigbike}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/bigbike}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-14}"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/bigbike_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u +%FT%TZ)] Starting backup → ${FILENAME}"

pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --format=custom \
  --compress=9 \
  --file="${FILENAME}"

echo "[$(date -u +%FT%TZ)] Backup complete: $(du -sh "${FILENAME}" | cut -f1)"

# Remove backups older than BACKUP_RETAIN_DAYS
find "${BACKUP_DIR}" -name "bigbike_*.dump" -mtime +"${BACKUP_RETAIN_DAYS}" -delete
echo "[$(date -u +%FT%TZ)] Pruned backups older than ${BACKUP_RETAIN_DAYS} days."
