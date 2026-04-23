#!/usr/bin/env bash
# PostgreSQL restore script for BigBike.
# Usage: ./restore.sh <backup-file.dump>
# WARNING: This will DROP and recreate the target database.
set -euo pipefail

DUMP_FILE="${1:-}"
if [[ -z "${DUMP_FILE}" ]]; then
  echo "Usage: $0 <backup-file.dump>" >&2
  exit 1
fi
if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "Error: dump file not found: ${DUMP_FILE}" >&2
  exit 1
fi

POSTGRES_HOST="${POSTGRES_HOST:-localhost}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-bigbike}"
POSTGRES_USER="${POSTGRES_USER:-bigbike}"
POSTGRES_SUPERUSER="${POSTGRES_SUPERUSER:-postgres}"

echo "[$(date -u +%FT%TZ)] Restoring ${DUMP_FILE} → ${POSTGRES_DB} on ${POSTGRES_HOST}:${POSTGRES_PORT}"

# Confirm before destroying existing data
read -r -p "This will DROP the '${POSTGRES_DB}' database. Type 'yes' to continue: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted." && exit 0
fi

# Terminate existing connections
psql \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_SUPERUSER}" \
  --dbname=postgres \
  --command="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}' AND pid <> pg_backend_pid();"

# Drop and recreate the database
psql \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_SUPERUSER}" \
  --dbname=postgres \
  --command="DROP DATABASE IF EXISTS \"${POSTGRES_DB}\"; CREATE DATABASE \"${POSTGRES_DB}\" OWNER \"${POSTGRES_USER}\";"

# Restore
pg_restore \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-owner \
  --no-privileges \
  --verbose \
  "${DUMP_FILE}"

echo "[$(date -u +%FT%TZ)] Restore complete."
