#!/usr/bin/env python3
"""
phase5_media_to_minio.py - Download WordPress media files and upload to MinIO.

Downloads each file from https://bigbike.vn/wp-content/uploads/{file_path},
uploads to MinIO bucket, then updates the media row in PostgreSQL.

Usage:
    pip install minio psycopg2-binary requests
    python phase5_media_to_minio.py [--workers N] [--dry-run] [--limit N]

Environment (or .env in project root):
    PG_DSN / PG_HOST / PG_USER / PG_PASSWORD / PG_DB
    MINIO_ENDPOINT   localhost:9000
    MINIO_ACCESS_KEY minio_admin
    MINIO_SECRET_KEY minio_dev_only
    MINIO_BUCKET     bigbike-media
    WP_BASE_URL      https://bigbike.vn/wp-content/uploads
"""

import argparse
import io
import logging
import os
import sys
import time
import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import requests
except ImportError:
    sys.exit("requests not found. Run: pip install requests")

try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool
except ImportError:
    sys.exit("psycopg2 not found. Run: pip install psycopg2-binary")

try:
    from minio import Minio
    from minio.error import S3Error
except ImportError:
    sys.exit("minio not found. Run: pip install minio")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

WP_BASE_URL   = os.getenv("WP_BASE_URL",   "https://bigbike.vn/wp-content/uploads")
MINIO_ENDPOINT   = os.getenv("MINIO_ENDPOINT",   "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", os.getenv("MINIO_ROOT_USER", "minio_admin"))
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", os.getenv("MINIO_ROOT_PASSWORD", "minio_dev_only"))
MINIO_BUCKET     = os.getenv("MINIO_BUCKET",     "bigbike-media")
MINIO_PUBLIC_BASE = f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}"

REQUEST_TIMEOUT = 30
REQUEST_RETRIES = 3
CHUNK_SIZE      = 1024 * 256  # 256 KB

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

log_dir = Path(__file__).parent / "logs"
log_dir.mkdir(exist_ok=True)
log_file = log_dir / f"phase5-{datetime.date.today()}.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ],
)
log = logging.getLogger(__name__)

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    import io as _io
    sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_db_conn():
    dsn = os.getenv("PG_DSN")
    if dsn:
        return psycopg2.connect(dsn)
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "localhost"),
        port=int(os.getenv("PG_PORT", "5432")),
        dbname=os.getenv("PG_DB", "bigbike"),
        user=os.getenv("PG_USER", "bigbike"),
        password=os.getenv("PG_PASSWORD", "bigbike_dev_only"),
    )


def load_pending(conn, limit=None):
    sql = """
        SELECT id::text, file_path, mime_type
        FROM media
        WHERE storage_provider = 'LEGACY_WP'
        ORDER BY file_path
    """
    if limit:
        sql += f" LIMIT {int(limit)}"
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(sql)
        return cur.fetchall()


def mark_uploaded(conn, media_id: str, bucket: str, public_url: str, file_size: int):
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE media
               SET storage_provider = 'MINIO',
                   bucket           = %s,
                   public_url       = %s,
                   file_size        = COALESCE(file_size, %s),
                   updated_at       = NOW()
               WHERE id = %s::uuid""",
            (bucket, public_url, file_size, media_id),
        )
    conn.commit()


def mark_failed(conn, media_id: str, reason: str):
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE media
               SET storage_provider = 'LEGACY_WP_FAILED',
                   updated_at       = NOW()
               WHERE id = %s::uuid""",
            (media_id,),
        )
    conn.commit()
    log.warning("FAILED %s — %s", media_id, reason)

# ---------------------------------------------------------------------------
# Download helper
# ---------------------------------------------------------------------------

session = requests.Session()
session.headers["User-Agent"] = "BigBike-MediaMigrator/1.0"

def download_bytes(file_path: str) -> bytes:
    url = f"{WP_BASE_URL}/{file_path}"
    for attempt in range(1, REQUEST_RETRIES + 1):
        try:
            resp = session.get(url, timeout=REQUEST_TIMEOUT, stream=True)
            if resp.status_code == 404:
                raise FileNotFoundError(f"404 {url}")
            resp.raise_for_status()
            buf = io.BytesIO()
            for chunk in resp.iter_content(CHUNK_SIZE):
                buf.write(chunk)
            return buf.getvalue()
        except FileNotFoundError:
            raise
        except Exception as e:
            if attempt == REQUEST_RETRIES:
                raise
            time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")

# ---------------------------------------------------------------------------
# Worker
# ---------------------------------------------------------------------------

def process_one(row, minio_client, conn, dry_run: bool) -> tuple[str, bool, str]:
    media_id  = row["id"]
    file_path = row["file_path"]
    mime_type = row["mime_type"] or "application/octet-stream"

    try:
        data = download_bytes(file_path)
        size = len(data)

        if not dry_run:
            minio_client.put_object(
                MINIO_BUCKET,
                file_path,
                io.BytesIO(data),
                length=size,
                content_type=mime_type,
            )
            public_url = f"{MINIO_PUBLIC_BASE}/{file_path}"
            mark_uploaded(conn, media_id, MINIO_BUCKET, public_url, size)

        return media_id, True, f"{size // 1024} KB"

    except FileNotFoundError as e:
        if not dry_run:
            mark_failed(conn, media_id, str(e))
        return media_id, False, str(e)

    except Exception as e:
        if not dry_run:
            mark_failed(conn, media_id, str(e))
        return media_id, False, str(e)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Phase 5: WordPress media → MinIO")
    parser.add_argument("--workers", type=int, default=8, help="Parallel download threads (default: 8)")
    parser.add_argument("--dry-run", action="store_true", help="Download only, do not upload or update DB")
    parser.add_argument("--limit",   type=int, default=None, help="Process only N rows (for testing)")
    args = parser.parse_args()

    log.info("=== Phase 5: Media Migration to MinIO ===")
    log.info("Endpoint: %s  Bucket: %s  Workers: %d  DryRun: %s",
             MINIO_ENDPOINT, MINIO_BUCKET, args.workers, args.dry_run)

    # --- MinIO setup ---
    minio_client = Minio(MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, secure=False)
    if not args.dry_run:
        if not minio_client.bucket_exists(MINIO_BUCKET):
            minio_client.make_bucket(MINIO_BUCKET)
            log.info("Created bucket: %s", MINIO_BUCKET)
        else:
            log.info("Bucket already exists: %s", MINIO_BUCKET)

    # --- DB setup ---
    conn = get_db_conn()
    rows = load_pending(conn, limit=args.limit)
    total = len(rows)
    log.info("Pending LEGACY_WP rows: %d", total)

    if total == 0:
        log.info("Nothing to do.")
        return

    # --- Process ---
    success = failed = 0
    start = time.time()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        # Each worker needs its own DB connection to avoid conflicts
        conns = [get_db_conn() for _ in range(args.workers)]
        futures = {}

        for i, row in enumerate(rows):
            worker_conn = conns[i % args.workers]
            f = pool.submit(process_one, row, minio_client, worker_conn, args.dry_run)
            futures[f] = row["file_path"]

        for done_count, f in enumerate(as_completed(futures), 1):
            media_id, ok, detail = f.result()
            if ok:
                success += 1
            else:
                failed += 1

            if done_count % 100 == 0 or done_count == total:
                elapsed = time.time() - start
                rate = done_count / elapsed if elapsed > 0 else 0
                eta = (total - done_count) / rate if rate > 0 else 0
                log.info("[%d/%d] ok=%d fail=%d  %.1f/s  ETA %.0fs",
                         done_count, total, success, failed, rate, eta)

    for c in conns:
        c.close()
    conn.close()

    elapsed = time.time() - start
    log.info("=== DONE: success=%d  failed=%d  elapsed=%.1fs ===", success, failed, elapsed)
    log.info("Log: %s", log_file)

    if failed > 0:
        log.warning("%d files failed (marked LEGACY_WP_FAILED in DB). "
                    "Check log for details. Re-run to retry is not automatic — "
                    "reset storage_provider='LEGACY_WP' to retry.", failed)


if __name__ == "__main__":
    main()
