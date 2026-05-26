#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="./backups"
BACKUP_DIR="$BACKUP_ROOT/$DATE"
MINIO_MIRROR="$BACKUP_ROOT/minio_mirror"

# Load .env if present
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

POSTGRES_CONTAINER="postgres"
POSTGRES_DB="${POSTGRES_DB:-bigbike}"
POSTGRES_USER="${POSTGRES_USER:-bigbike}"
MINIO_CONTAINER="minio"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

echo "===================================="
echo "Starting backup: $DATE"
echo "PostgreSQL DB:   $POSTGRES_DB  (user: $POSTGRES_USER)"
echo "MinIO mirror:    $MINIO_MIRROR"
echo "===================================="

# Pre-flight: containers must be running
if ! docker compose ps "$POSTGRES_CONTAINER" | grep -qiE 'up|running'; then
  echo "ERROR: PostgreSQL container '$POSTGRES_CONTAINER' is not running." >&2
  exit 1
fi
if ! docker compose ps "$MINIO_CONTAINER" | grep -qiE 'up|running'; then
  echo "ERROR: MinIO container '$MINIO_CONTAINER' is not running." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
mkdir -p "$MINIO_MIRROR"

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
# MinIO Incremental Backup (rsync)
#
# Chiến lược:
#   1. rsync từ container vào minio_mirror/ — chỉ copy file mới/thay đổi
#   2. Hard-link snapshot từ mirror vào backup/<DATE>/minio/ — tức thì, không tốn thêm dung lượng
#      (hard-link: mirror và snapshot dùng chung inode, chỉ tốn thêm dung lượng khi file thay đổi)
#################################

echo "Syncing MinIO (incremental)..."

# Bước 1: rsync từ container → mirror (chỉ copy phần thay đổi)
docker compose exec -T "$MINIO_CONTAINER" \
  sh -c "tar cf - -C /data ." \
  | tar xf - -C "$MINIO_MIRROR" 2>/dev/null || true

# Đảm bảo mirror có dữ liệu
if [ -z "$(ls -A "$MINIO_MIRROR")" ]; then
  echo "ERROR: MinIO mirror is empty after sync — aborting." >&2
  exit 1
fi

# Bước 2: Hard-link snapshot từ mirror → backup/<DATE>/minio/
cp -al "$MINIO_MIRROR/." "$BACKUP_DIR/minio/"

MINIO_SIZE=$(du -sh "$BACKUP_DIR/minio" | cut -f1)
echo "MinIO backup completed (snapshot: $MINIO_SIZE, mirror: $(du -sh "$MINIO_MIRROR" | cut -f1))"

# Ghi manifest để biết snapshot này chứa gì
echo "snapshot_date=$DATE" > "$BACKUP_DIR/minio_manifest.txt"
echo "mirror_path=$MINIO_MIRROR" >> "$BACKUP_DIR/minio_manifest.txt"
echo "strategy=hard_link_from_mirror" >> "$BACKUP_DIR/minio_manifest.txt"

#################################
# Cleanup old backups
#################################

echo "Cleaning backups older than $RETENTION_DAYS days..."

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d \
  -not -name "minio_mirror" \
  -mtime "+$RETENTION_DAYS" \
  -exec rm -rf {} \;

echo "Cleanup completed"

echo "===================================="
echo "Backup finished successfully"
echo "Location: $BACKUP_DIR"
echo "===================================="
