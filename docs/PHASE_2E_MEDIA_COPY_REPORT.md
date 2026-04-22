# Phase 2E — Media Copy & Sync Report

## Summary

| Metric | Value |
|--------|-------|
| Run date | _(fill after run)_ |
| Mode | dry-run / copy |
| Environment | local / staging |
| Duration | — ms |
| Throughput | — MB/s |

## Counts

| Category | Count |
|----------|-------|
| Total DB records (LEGACY_WP) | ~12,054 |
| Total files found on disk | — |
| Total size on disk | ~8 GB |
| Copied (new) | — |
| Skipped (already in MinIO) | — |
| Missing source (not on disk) | — |
| Checksum mismatch (re-copied) | — |
| Failed | — |

## Storage Mapping

| Path type | Example |
|-----------|---------|
| WP uploads path | `/data/wp-content/uploads/` |
| WP file path (DB) | `2024/05/xe-may-honda.jpg` |
| MinIO object key | `wp-uploads/2024/05/xe-may-honda.jpg` |
| MinIO public URL | `http://localhost:9000/bigbike-media/wp-uploads/2024/05/xe-may-honda.jpg` |

## Missing Files

Files present in `media` table but absent from the uploads directory.
These are logged but do not fail the run.

```
(paste MISSING: lines from run log here)
```

## Errors

Copy failures after all retries exhausted.

```
(paste ERROR: lines from run log here)
```

## Performance

| Metric | Value |
|--------|-------|
| Wall-clock time | — |
| Throughput | — MB/s |
| Avg file size | — KB |
| Retry count | — |

## How to Run

### 1. Dry-run (scan only, no MinIO connection)

```bash
java -jar bigbike-backend.jar \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.mode=media-copy \
  --bigbike.migration.wordpress.dry-run=true \
  --bigbike.migration.wordpress.uploads-path=/data/wp-content/uploads
```

### 2. Real copy (local environment)

Ensure MinIO is running (`docker compose up minio`) and the bucket exists or will be created automatically.

```bash
java -jar bigbike-backend.jar \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.mode=media-copy \
  --bigbike.migration.wordpress.dry-run=false \
  --bigbike.migration.wordpress.confirm-execute=true \
  --bigbike.migration.wordpress.environment=local \
  --bigbike.migration.wordpress.uploads-path=/data/wp-content/uploads \
  --bigbike.migration.wordpress.minio-endpoint=http://localhost:9000 \
  --bigbike.migration.wordpress.minio-access-key=minio_admin \
  --bigbike.migration.wordpress.minio-secret-key=minio_dev_only \
  --bigbike.migration.wordpress.minio-bucket=bigbike-media
```

### 3. Re-run (idempotent)

Running the copy again is safe. Files already in MinIO with a matching ETag are skipped automatically.

## Safety Checklist

- [ ] `docker compose up minio postgres` — services running
- [ ] Uploads directory mounted and readable
- [ ] No production DB URL in `BIGBIKE_DB_URL`
- [ ] `environment=local` or `environment=staging` set
- [ ] `confirm-execute=true` set explicitly
- [ ] Dry-run verified first (zero failures)
- [ ] MinIO console checked at http://localhost:9001

## Implementation Files

| File | Purpose |
|------|---------|
| `migration/wordpress/media/MediaCopyRunner.java` | ApplicationRunner — guards + orchestration |
| `migration/wordpress/media/MediaCopyService.java` | Core copy loop — skip, retry, checksum |
| `migration/wordpress/media/MinioMediaStorageAdapter.java` | MinIO SDK adapter |
| `migration/wordpress/media/MediaStoragePort.java` | Storage abstraction (testable) |
| `migration/wordpress/media/MediaPathResolver.java` | WP path → storage key + public URL |
| `migration/wordpress/media/MediaChecksumService.java` | Streaming MD5/SHA-256 |
| `migration/wordpress/media/MediaCopyOptions.java` | Run options record |
| `migration/wordpress/media/MediaCopyReport.java` | Run result record |
| `test/.../Phase2EMediaCopyTest.java` | Unit tests (8 scenarios) |
