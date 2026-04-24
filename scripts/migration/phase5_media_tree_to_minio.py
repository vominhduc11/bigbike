#!/usr/bin/env python3
"""
phase5_media_tree_to_minio.py - Copy all WordPress image/video assets from a local wp-content tree to MinIO.

This script is broader than the legacy attachment-only media copy:

- It scans the entire wp-content tree for image/video files.
- It uploads uploads/ files under the legacy "wp-uploads/" prefix.
- It uploads theme/plugin assets under "wp-content/<relative-path>".
- It syncs legacy attachment rows in PostgreSQL to MINIO after upload.

Usage:
    pip install minio psycopg2-binary python-dotenv
    python phase5_media_tree_to_minio.py \
        --source-root ./bigbike_vn__2026_04_17/files/wp-content \
        --endpoint http://localhost:9000 \
        --access-key minio_admin \
        --secret-key minio_dev_only \
        --bucket bigbike-media
"""

from __future__ import annotations

import argparse
import datetime
import mimetypes
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    from minio import Minio
except ImportError:
    sys.exit("minio not found. Run: pip install minio")

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("psycopg2 not found. Run: pip install psycopg2-binary")

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent.parent / ".env")
except ImportError:
    pass


ALLOWED_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".ico",
    ".bmp", ".tif", ".tiff",
    ".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv", ".mpg", ".mpeg",
}

THREAD_LOCAL = threading.local()


def _get_db_conn():
    dsn = os.getenv("PG_DSN")
    if dsn:
        return psycopg2.connect(dsn)
    jdbc = os.getenv("BIGBIKE_DB_URL", "")
    if jdbc.startswith("jdbc:postgresql://"):
        jdbc_clean = jdbc[len("jdbc:postgresql://") :]
        host_port, db = jdbc_clean.split("/", 1)
        host, port = (host_port.split(":") + ["5432"])[:2]
        return psycopg2.connect(
            host=host,
            port=int(port),
            dbname=db,
            user=os.getenv("BIGBIKE_DB_USERNAME", os.getenv("PG_USER", "bigbike")),
            password=os.getenv("BIGBIKE_DB_PASSWORD", os.getenv("PG_PASSWORD", "bigbike_dev_only")),
        )
    return psycopg2.connect(
        host=os.getenv("PG_HOST", "localhost"),
        port=int(os.getenv("PG_PORT", "5432")),
        dbname=os.getenv("PG_DB", "bigbike"),
        user=os.getenv("PG_USER", "bigbike"),
        password=os.getenv("PG_PASSWORD", "bigbike_dev_only"),
    )


def _get_minio_client(endpoint: str, access_key: str, secret_key: str) -> Minio:
    client = getattr(THREAD_LOCAL, "minio_client", None)
    if client is None:
        client = Minio(endpoint.replace("http://", "").replace("https://", ""), access_key, secret_key, secure=endpoint.startswith("https://"))
        THREAD_LOCAL.minio_client = client
    return client


def _normalize_rel_path(path: str) -> str:
    rel = path.replace("\\", "/").strip()
    if rel.startswith("/"):
        rel = rel[1:]
    if rel.startswith("wp-content/uploads/"):
        rel = rel[len("wp-content/uploads/") :]
    elif rel.startswith("uploads/"):
        rel = rel[len("uploads/") :]
    return rel


def _object_key(source_root: Path, file_path: Path) -> str:
    rel = file_path.relative_to(source_root).as_posix()
    if rel.startswith("uploads/"):
        return "wp-uploads/" + rel[len("uploads/") :]
    return "wp-content/" + rel


def _public_url(endpoint: str, bucket: str, key: str) -> str:
    base = endpoint[:-1] if endpoint.endswith("/") else endpoint
    return f"{base}/{bucket}/{key}"


def _guess_content_type(file_path: Path) -> str:
    mime, _ = mimetypes.guess_type(file_path.name)
    return mime or "application/octet-stream"


def _collect_media_files(source_root: Path) -> list[Path]:
    files: list[Path] = []
    for file_path in source_root.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append(file_path)
    files.sort()
    return files


def _ensure_bucket(endpoint: str, access_key: str, secret_key: str, bucket: str) -> None:
    client = _get_minio_client(endpoint, access_key, secret_key)
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def _upload_one(source_root: Path, endpoint: str, access_key: str, secret_key: str, bucket: str, file_path: Path, dry_run: bool):
    key = _object_key(source_root, file_path)
    content_type = _guess_content_type(file_path)

    try:
        if not dry_run:
            client = _get_minio_client(endpoint, access_key, secret_key)
            client.fput_object(bucket, key, str(file_path), content_type=content_type)
        return True, key, None
    except Exception as exc:  # noqa: BLE001
        return False, key, str(exc)


def _mark_uploaded(conn, media_id: str, bucket: str, public_url: str, file_size: int) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE media
            SET storage_provider = 'MINIO',
                bucket = %s,
                public_url = %s,
                file_size = %s,
                updated_at = NOW()
            WHERE id = %s::uuid
            """,
            (bucket, public_url, file_size, media_id),
        )
    conn.commit()


def _load_legacy_media(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT id::text, file_path, mime_type
            FROM media
            WHERE storage_provider = 'LEGACY_WP'
            ORDER BY file_path
            """
        )
        return cur.fetchall()


def _sync_legacy_rows(conn, source_root: Path, endpoint: str, bucket: str, dry_run: bool):
    rows = _load_legacy_media(conn)
    updated = 0
    missing = 0
    errors = 0

    uploads_root = source_root / "uploads"
    for row in rows:
        file_path = _normalize_rel_path(str(row["file_path"] or ""))
        if not file_path:
            missing += 1
            continue

        source_file = uploads_root / file_path
        if not source_file.exists():
            missing += 1
            continue

        if dry_run:
            updated += 1
            continue

        try:
            _mark_uploaded(
                conn,
                row["id"],
                bucket,
                _public_url(endpoint, bucket, f"wp-uploads/{file_path}"),
                source_file.stat().st_size,
            )
            updated += 1
        except Exception as exc:  # noqa: BLE001
            print(f"DB update failed for media {row['id']} ({file_path}): {exc}", flush=True)
            errors += 1

    return updated, missing, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Copy all WP image/video assets from wp-content to MinIO.")
    parser.add_argument(
        "--source-root",
        default=str(Path("bigbike_vn__2026_04_17") / "files" / "wp-content"),
        help="Local wp-content directory to scan (default: ./bigbike_vn__2026_04_17/files/wp-content)",
    )
    parser.add_argument("--endpoint", default=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"))
    parser.add_argument("--access-key", default=os.getenv("MINIO_ACCESS_KEY", os.getenv("MINIO_ROOT_USER", "minio_admin")))
    parser.add_argument("--secret-key", default=os.getenv("MINIO_SECRET_KEY", os.getenv("MINIO_ROOT_PASSWORD", "minio_dev_only")))
    parser.add_argument("--bucket", default=os.getenv("MINIO_BUCKET", "bigbike-media"))
    parser.add_argument("--workers", type=int, default=8, help="Parallel upload workers")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report only, do not upload or update DB")
    parser.add_argument("--limit", type=int, default=None, help="Limit file count for testing")
    args = parser.parse_args()

    source_root = Path(args.source_root).resolve()
    if not source_root.exists() or not source_root.is_dir():
        sys.exit(f"Source root not found: {source_root}")

    log_dir = Path(__file__).parent / "logs"
    log_dir.mkdir(exist_ok=True)
    log_file = log_dir / f"phase5-tree-{datetime.date.today()}.log"

    def log(msg: str):
        print(msg, flush=True)
        with open(log_file, "a", encoding="utf-8") as fh:
            fh.write(msg + "\n")

    mimetypes.add_type("image/svg+xml", ".svg")
    mimetypes.add_type("image/avif", ".avif")

    log("=== Phase 5: wp-content tree copy to MinIO ===")
    log(f"Source root: {source_root}")
    log(f"Endpoint:    {args.endpoint}")
    log(f"Bucket:      {args.bucket}")
    log(f"Workers:     {args.workers}")
    log(f"Dry run:     {args.dry_run}")

    files = _collect_media_files(source_root)
    if args.limit is not None:
        files = files[: args.limit]
    total_size = sum(f.stat().st_size for f in files)
    log(f"Media files: {len(files)}")
    log(f"Total size:  {total_size} bytes ({total_size / (1024 * 1024):.2f} MB)")

    if args.dry_run:
        log("Dry run complete. No uploads or DB updates were performed.")
        return 0

    _ensure_bucket(args.endpoint, args.access_key, args.secret_key, args.bucket)

    start = time.time()
    uploaded = 0
    failed = 0

    def worker(file_path: Path):
        return _upload_one(source_root, args.endpoint, args.access_key, args.secret_key, args.bucket, file_path, False)

    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        for idx, result in enumerate(executor.map(worker, files), 1):
            ok, key, error = result
            if ok:
                uploaded += 1
            else:
                failed += 1
                log(f"ERROR upload failed for {key}: {error}")

            if idx % 1000 == 0 or idx == len(files):
                elapsed = max(time.time() - start, 0.001)
                rate = idx / elapsed
                eta = (len(files) - idx) / rate if rate > 0 else 0
                log(f"[{idx}/{len(files)}] uploaded={uploaded} failed={failed} rate={rate:.1f}/s eta={eta:.0f}s")

    conn = _get_db_conn()
    try:
        updated, missing, errors = _sync_legacy_rows(conn, source_root, args.endpoint, args.bucket, False)
    finally:
        conn.close()

    elapsed = time.time() - start
    log("=== DB SYNC COMPLETE ===")
    log(f"Legacy rows updated: {updated}")
    log(f"Legacy rows missing:  {missing}")
    log(f"Legacy rows errors:   {errors}")
    log(f"Uploaded files:       {uploaded}")
    log(f"Failed uploads:       {failed}")
    log(f"Elapsed seconds:      {elapsed:.1f}")
    log(f"Log file:             {log_file}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
