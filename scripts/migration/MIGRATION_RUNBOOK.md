# BigBike WordPress → PostgreSQL Migration Runbook

**Cập nhật lần cuối:** 2026-04-23  
**Môi trường đích:** PostgreSQL 16 (Docker `bigbike-postgres`)  
**Công cụ chính:** Spring Boot migration runner tích hợp trong `bigbike-backend`  
**Dump source:** `bigbike_vn__2026_04_17/sqldump.sql` (~127 MB, MariaDB 10.11, prefix `kd_`)

---

## Trạng thái hiện tại

| Domain | Source | Đã import (rehearsal local) | Còn lại |
|--------|-------:|----------------------------:|---------|
| Categories | 50 | 50 ✅ | — |
| Brands | 45 | 45 ✅ | — |
| Products | 1,227 | 1,217 ✅ (2 unrecoverable) | 2 bỏ |
| Product Variations | 4,040 | 4,015 ✅ (25 orphan) | 25 bỏ |
| Media (DB records) | 12,054 | 12,054 ✅ | files chưa copy |
| Pages | 22 | 22 ✅ | — |
| Articles | 174 | 169 ✅ (5 blank slug) | 5 bỏ |
| Menus | 3 + 46 items | 3 + 46 ✅ | — |
| Redirects (RankMath) | 40 | 40 ✅ | — |
| Redirects (FG ~19,491 + fallback ~1,312) | ~20,803 | **chưa import** | Phase 3 |
| Customers | 1,929 (role=customer) | 1,929 ✅ | — |
| Orders | 1,061 | 1,061 ✅ | — |
| Order items | 1,309 + 834 | 2,143 ✅ | — |
| Payments | 1,061 | 1,061 ✅ | — |
| Coupons | 1 | 1 ✅ | — |
| Product tags | 2,895 | deferred | schema chưa thiết kế |
| Media files (~8 GB) | 12,054 files | **chưa copy** | Phase 2E |

---

## Yêu cầu môi trường

```bash
# Services cần running
docker compose up -d postgres redis minio

# Kiểm tra services healthy
docker ps --filter name=bigbike --format "table {{.Names}}\t{{.Status}}"

# Build jar (nếu chưa có)
cd bigbike-backend
./mvnw package -DskipTests -q
JAR=target/bigbike-backend-0.0.1-SNAPSHOT.jar
```

**Biến môi trường cần thiết:**
```bash
export BIGBIKE_DB_URL=jdbc:postgresql://localhost:5432/bigbike
export BIGBIKE_DB_USERNAME=bigbike
export BIGBIKE_DB_PASSWORD=bigbike_dev_only
export BIGBIKE_JWT_SECRET=local-dev-secret-bigbike-change-in-prod!
export MINIO_ENDPOINT=http://localhost:9000
export MINIO_ROOT_USER=minio_admin
export MINIO_ROOT_PASSWORD=minio_dev_only
export MINIO_BUCKET=bigbike-media
export DUMP_PATH=../bigbike_vn__2026_04_17/sqldump.sql
```

> Note: the dump is UTF-8. If you rerun import against an already-seeded local DB, disable Flyway with `--spring.flyway.enabled=false` so the dev seed migration does not abort startup.

---

## Phase 1 — Dry-run kiểm tra dump (an toàn, không ghi DB)

Chạy dry-run để verify counts trước khi ghi thật:

```bash
java -jar $JAR \
  --spring.profiles.active=dev \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.dry-run=true \
  --bigbike.migration.wordpress.sql-dump-path=$DUMP_PATH \
  --bigbike.migration.wordpress.mode=catalog-dry-run
```

**Kết quả mong đợi (từ Phase 2B.1):**
```
products     source=1227  mapped=1150  skipped=77
variations   source=4040  mapped=4040
categories   source=50    mapped=50
brands       source=45    mapped=45
media        source=12054 mapped=12054
pages        source=22    mapped=22
articles     source=174   mapped=174
menus        source=3     mapped=3
rank_math    source=40    mapped=40
```

---

## Phase 2 — Write Plan (xem kế hoạch trước khi ghi)

```bash
java -jar $JAR \
  --spring.profiles.active=dev \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.dry-run=true \
  --bigbike.migration.wordpress.sql-dump-path=$DUMP_PATH \
  --bigbike.migration.wordpress.mode=write-plan
```

Đọc output `=== PHASE2D_WRITE_PLAN_BEGIN ===` — verify tổng rows và deferred domains trước bước tiếp.

---

## Phase 3 — Import catalog + content + commerce (ghi thật)

> ⚠️ **Bước này ghi vào DB thật.** Đảm bảo `confirm-execute=true` và `environment=local`.

```bash
java -jar $JAR \
  --spring.profiles.active=dev \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.dry-run=false \
  --bigbike.migration.wordpress.confirm-execute=true \
  --bigbike.migration.wordpress.environment=local \
  --bigbike.migration.wordpress.sql-dump-path=$DUMP_PATH \
  --bigbike.migration.wordpress.mode=import
```

**Kết quả mong đợi (từ Phase 2D.3, Run 1):**
```
Duration: ~69s
Inserted: 5327   Updated: 8   Skipped: 27   Failed: 0

[CATEGORIES]          inserted=50    skipped=0   failed=0
[BRANDS]              inserted=45    skipped=0   failed=0
[PRODUCTS]            inserted=1217  skipped=2   failed=0
[PRODUCT_VARIATIONS]  inserted=4015  skipped=25  failed=0
[MEDIA]               inserted=12054 skipped=0   failed=0
[PAGES]               inserted=22    skipped=0   failed=0
[ARTICLES]            inserted=169   skipped=5   failed=0
[MENUS]               inserted=3     skipped=0   failed=0
[CUSTOMERS]           inserted=1929  skipped=0   failed=0
[ORDERS]              inserted=1061  skipped=0   failed=0
[COUPONS]             inserted=1     skipped=0   failed=0
[REDIRECTS]           inserted=40    skipped=0   failed=0
```

**Idempotent:** Chạy lại lần 2 → inserted=0, updated=N, skipped giống lần 1.

---

## Phase 4 — Import FG Redirects + Legacy URL fallback

Phase 2D.4 đã implement `RedirectResolverService` (3 tầng: RankMath → FG → fallback).  
Chạy mode `redirect-full` để import toàn bộ:

```bash
java -jar $JAR \
  --spring.profiles.active=dev \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.dry-run=false \
  --bigbike.migration.wordpress.confirm-execute=true \
  --bigbike.migration.wordpress.environment=local \
  --bigbike.migration.wordpress.sql-dump-path=$DUMP_PATH \
  --bigbike.migration.wordpress.mode=redirect-full
```

**Kết quả mong đợi:**
```
RankMath:  imported=40
FG:        resolved=~19491  deferred=~25
Fallback:  generated=~1312  conflicts=~0
Total redirects in DB: ~20843
```

---

## Phase 5 — Copy media files lên MinIO

> ⚠️ **Yêu cầu:** Thư mục `wp-content/uploads` phải có sẵn trên máy local.  
> File dump không chứa media — phải copy từ server WordPress gốc qua `rsync` hoặc `scp`.

```bash
# Sync uploads từ server cũ (chạy trước)
rsync -avz --progress user@old-server:/var/www/html/wp-content/uploads/ \
  ./bigbike_vn__2026_04_17/uploads/

# Dry-run media copy (verify trước)
java -jar $JAR \
  --spring.profiles.active=dev \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.dry-run=true \
  --bigbike.migration.wordpress.mode=media-copy \
  --bigbike.migration.wordpress.uploads-path=./bigbike_vn__2026_04_17/uploads

# Real copy
java -jar $JAR \
  --spring.profiles.active=dev \
  --bigbike.migration.wordpress.enabled=true \
  --bigbike.migration.wordpress.dry-run=false \
  --bigbike.migration.wordpress.confirm-execute=true \
  --bigbike.migration.wordpress.environment=local \
  --bigbike.migration.wordpress.mode=media-copy \
  --bigbike.migration.wordpress.uploads-path=./bigbike_vn__2026_04_17/uploads \
  --bigbike.migration.wordpress.minio-endpoint=http://localhost:9000 \
  --bigbike.migration.wordpress.minio-access-key=minio_admin \
  --bigbike.migration.wordpress.minio-secret-key=minio_dev_only \
  --bigbike.migration.wordpress.minio-bucket=bigbike-media
```

**Kết quả mong đợi:**
```
Total DB records:  12054
Copied (new):      ~12054
Skipped (exists):  0 (lần đầu)
Missing source:    <N> (files không có trên disk — log cảnh báo)
Failed:            0
```

> For the full `wp-content` tree, including theme and plugin images/videos plus WordPress-generated variants, use `scripts/migration/phase5_media_tree_to_minio.py`. It preserves uploads under `wp-uploads/` and writes the rest under `wp-content/...`, then syncs `media` rows to `MINIO`.

---

## Phase 6 — Validation sau import

```bash
# Cài requirements
pip install psycopg2-binary python-dotenv

# Chạy validation
cd scripts/migration
python validate_migration.py

# Sinh SEO redirect CSV
python generate_seo_redirect_map.py
```

Kiểm tra output:
- `logs/validation-YYYY-MM-DD.txt` — báo cáo toàn diện
- `SEO_REDIRECT_MAP.csv` — 20,000+ redirects để cấu hình nginx/CDN

---

## Phase 7 — Production cutover checklist

Khi tất cả validation pass trên local:

```bash
# 1. Lock WordPress (tắt admin, không cho edit mới)
# 2. Backup final
pg_dump -Fc -Z9 bigbike > backup-pre-cutover-$(date +%Y%m%d).dump

# 3. Chạy lại import (pick up delta nếu có) 
#    Vì tất cả importers là idempotent → updated=N, inserted≈0

# 4. Validate lại
python scripts/migration/validate_migration.py

# 5. Switch DNS → bigbike-web:3000
# 6. Monitor 404/redirect logs 24h đầu
```

---

## Các items bị bỏ qua (có chủ ý)

| Domain | Lý do bỏ |
|--------|-----------|
| 2 products (blank name+slug) | Không thể recover, không bao giờ có public URL |
| 25 product_variations | Orphan từ 2 products trên |
| 5 articles (blank slug) | Không có natural key để upsert |
| 2,895 product_tags | Schema đích chưa thiết kế trong V1-V13 |
| kd_wc_orders (HPOS) | HPOS tắt (`woocommerce_custom_orders_table_enabled=no`), dữ liệu stale |
| kd_actionscheduler_* | WP job queue — không cần migrate |
| kd_rank_math_404_logs, kd_wf* | Log/analytics nội bộ WP |
| kd_woocommerce_sessions | Cart sessions — ephemeral |
| Revision posts | WP internal — không migrate |

---

## Troubleshooting

### Lỗi "environment guard"
```
ERROR: Production guard triggered. Set --environment=local or --environment=staging.
```
→ Thêm `--bigbike.migration.wordpress.environment=local`

### Lỗi "confirm-execute required"
→ Thêm `--bigbike.migration.wordpress.confirm-execute=true`

### `ObjectOptimisticLockingFailureException`
→ Đã fix trong Phase 2D.1 (không set UUID thủ công). Nếu vẫn xảy ra: restart và chạy lại (idempotent).

### Customer `DataIntegrityViolationException` (varchar too long)
→ Đã fix trong Phase 2D.1: truncate ở 127/255 chars.

### Media copy: `Missing source file`
→ File tồn tại trong DB nhưng không có trên disk. Log cảnh báo, không fail. Cần sync `uploads/` từ server gốc.

### Encoding `MalformedInputException`
→ Dump là ISO-8859-1. Parser đã handle — không cần đổi encoding dump.
