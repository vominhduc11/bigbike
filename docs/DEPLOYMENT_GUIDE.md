# DEPLOYMENT_GUIDE.md — bigbike.vn

Hướng dẫn triển khai main-fe + admin-fe + backend + hạ tầng phụ trợ. Không hardcode secret.

Tham chiếu: [TECH_STACK.md](TECH_STACK.md), [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md), [MEDIA_ASSET_INVENTORY.md](MEDIA_ASSET_INVENTORY.md).

---

## 1. Environment overview

| Env | Mục đích | URL |
|---|---|---|
| local | Dev cá nhân | `http://localhost:3000` (main), `http://localhost:3001` (admin), `http://localhost:4000` (api) |
| staging | Test trước production; giống production về infra + data ẩn danh | `https://staging.bigbike.vn`, `https://admin-staging.bigbike.vn`, `https://api-staging.bigbike.vn` |
| production | Live | `https://bigbike.vn`, `https://admin.bigbike.vn`, `https://api.bigbike.vn` |
| wordpress-legacy | WordPress cũ giữ song song giai đoạn chuyển tiếp | `https://legacy.bigbike.vn` (internal, chặn public sau cutover) |

---

## 2. Domain / subdomain strategy

| Domain | Phục vụ |
|---|---|
| `bigbike.vn` | main-fe (Next.js) + proxy `/wp-content/uploads/*` → origin media |
| `admin.bigbike.vn` | admin-fe (auth gated) |
| `api.bigbike.vn` | backend API |
| `cdn.bigbike.vn` | CDN (Cloudflare R2 / S3) cho media + static assets |
| `legacy.bigbike.vn` | WordPress origin (chỉ sau khi DNS cắt, chặn public hoặc IP whitelist) |

DNS records:
- `A` / `AAAA` cho các subdomain → LB / Cloudflare.
- `CNAME` `www` → `bigbike.vn`.
- `TXT` cho SPF/DKIM/DMARC nếu gửi email.
- `TXT` `facebook-domain-verification` (giữ value từ header.php: `a5hwdqc9uvn7hkcfzxs340aot5w0xj`).
- `TXT` `google-site-verification` (2 giá trị từ header.php) — hoặc verify bằng meta tag.

---

## 3. SSL strategy

- Cloudflare SSL Full (Strict): cert origin do Let's Encrypt (certbot) hoặc Cloudflare Origin CA.
- HSTS max-age 31536000, includeSubDomains, preload (sau khi confirm HTTPS khắp nơi).
- Auto-renew certbot cron `0 3 * * *`.

---

## 4. Docker Compose strategy

Phase 1 khuyến nghị self-host qua Docker Compose trên 1–2 VPS. File `docker-compose.yml` nằm ở root monorepo.

```
Thành phần containers:
- nginx         (reverse proxy + TLS terminate — hoặc đứng sau Cloudflare)
- main-fe       (Next.js build standalone)
- admin-fe      (Next.js build standalone)
- api           (Spring Boot / NestJS)
- postgres      (PostgreSQL 16)
- redis         (Redis 7)
- minio         (S3-compatible, phase 1; phase 2 chuyển cloud)
- legacy-wordpress   (tạm giai đoạn chuyển tiếp)
```

Volume persistence:
- `postgres_data` → `/var/lib/postgresql/data`
- `redis_data` → `/data`
- `minio_data` → `/export`
- `uploads_legacy` (readonly volume trong nginx để proxy)

Khai báo `.env` nằm ngoài compose file, KHÔNG commit.

### 4.1 Kích hoạt

```bash
docker compose pull
docker compose up -d --remove-orphans
docker compose ps
docker compose logs -f main-fe
```

### 4.2 Build image

```bash
# Từ repo monorepo root
docker buildx build --platform linux/amd64 \
  -f apps/main-fe/Dockerfile \
  -t ghcr.io/your-org/bigbike-main-fe:$(git rev-parse --short HEAD) .

docker push ghcr.io/your-org/bigbike-main-fe:<tag>
```

Similar cho admin-fe và api.

---

## 5. Nginx reverse proxy strategy

File `nginx/nginx.conf` (ngoài Cloudflare):

```
# Pseudocode — các block chính
server {
  listen 443 ssl http2;
  server_name bigbike.vn;
  ssl_certificate /etc/letsencrypt/live/bigbike.vn/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/bigbike.vn/privkey.pem;

  # HSTS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  # Media proxy — giữ URL cũ
  location /wp-content/uploads/ {
    proxy_pass https://cdn.bigbike.vn;             # phase 2
    # proxy_pass http://legacy-wordpress:80;       # phase 1
    proxy_cache media_cache;
    proxy_cache_valid 200 30d;
    add_header X-Proxy-Cache $upstream_cache_status;
  }

  # Block WordPress legacy endpoints
  location ~ ^/(wp-admin|wp-login\.php|xmlrpc\.php|wp-json) {
    return 410;   # hoặc 403 cho wp-admin
  }

  # Block legacy admin ajax (các endpoint cũ đã chuyển sang /api/*)
  location = /wp-admin/admin-ajax.php {
    return 410;
  }

  # Feed / RSS
  location ~ /feed/? {
    return 410;
  }

  # Sitemap legacy
  location = /sitemap_index.xml { return 301 /sitemap.xml; }
  location ~ ^/(product|post|page|category|pwb-brand)-sitemap\.xml {
    rewrite ^/(.+)-sitemap\.xml$ /sitemap-$1.xml permanent;
  }

  # main-fe
  location / {
    proxy_pass http://main-fe:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
  }
}

server {
  listen 443 ssl http2;
  server_name admin.bigbike.vn;
  # ... SSL ...

  # Optional IP whitelist
  # allow 1.2.3.4/32;
  # deny all;

  location / {
    proxy_pass http://admin-fe:3001;
  }
}

server {
  listen 443 ssl http2;
  server_name api.bigbike.vn;
  # ... SSL ...

  # CORS handled by API app; nginx chỉ pass headers
  location / {
    proxy_pass http://api:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto https;
    client_max_body_size 20M;
  }
}

# HTTP → HTTPS
server {
  listen 80;
  server_name bigbike.vn admin.bigbike.vn api.bigbike.vn;
  return 301 https://$host$request_uri;
}
```

Trước nginx nên có Cloudflare: sẽ bổ sung rate-limit edge + WAF.

---

## 6. Build / start / restart commands

### 6.1 Build (đầu mỗi deploy)

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm -F main-fe build
pnpm -F admin-fe build
cd apps/api && mvn package -DskipTests    # Spring Boot
# hoặc
pnpm -F api build                          # NestJS
```

### 6.2 Start / restart

```bash
docker compose up -d --build main-fe admin-fe api
docker compose restart nginx               # nếu config thay đổi
```

### 6.3 Logs

```bash
docker compose logs --tail=200 -f main-fe
docker compose logs -f api
journalctl -u nginx -f                     # nếu nginx không trong compose
```

### 6.4 Shell vào container

```bash
docker compose exec api sh
docker compose exec postgres psql -U bigbike bigbike
```

---

## 7. Backup strategy

### 7.1 Database

```bash
# Daily, 02:00 +07
pg_dump --format=custom --compress=9 \
  -h $DB_HOST -U $DB_USER $DB_NAME \
  -f /backup/bigbike-$(date +%Y%m%d).dump
aws s3 cp /backup/bigbike-*.dump s3://bigbike-backup/postgres/ --storage-class STANDARD_IA
find /backup -name "bigbike-*.dump" -mtime +14 -delete
```

Retention:
- 14 ngày daily trên S3.
- 12 tháng monthly archive (S3 Glacier).

WAL shipping nếu dùng managed Postgres (Neon, RDS) cho Point-in-Time Recovery.

### 7.2 Media

```bash
# Mỗi tuần, rclone sync S3/MinIO
rclone sync s3-prod:bigbike-media s3-backup:bigbike-media-backup --progress
```

### 7.3 Application

- Image Docker tagged theo git SHA, lưu ≥ 30 ngày trên registry.
- `docker-compose.yml` + config nginx commit trong `infra/` repo riêng.

---

## 8. Restore strategy

### 8.1 DB restore

```bash
# Tải backup
aws s3 cp s3://bigbike-backup/postgres/bigbike-YYYYMMDD.dump /tmp/
# Drop + restore
dropdb -h $DB_HOST -U $DB_USER bigbike
createdb -h $DB_HOST -U $DB_USER bigbike
pg_restore -h $DB_HOST -U $DB_USER -d bigbike /tmp/bigbike-YYYYMMDD.dump
```

### 8.2 Media restore

```bash
rclone sync s3-backup:bigbike-media-backup s3-prod:bigbike-media
```

### 8.3 Drill

- Chạy restore drill trên staging mỗi quý.
- Ghi RTO (Recovery Time Objective) thực tế. Target: RTO 1h, RPO 24h phase 1.

---

## 9. Rollback strategy

### 9.1 App rollback (image-based)

```bash
# Giả sử tag mới bị lỗi
docker compose pull ghcr.io/your-org/bigbike-main-fe:PREVIOUS_GOOD_SHA
docker compose up -d main-fe
```

CI phải giữ `latest-good` tag cho image ổn định gần nhất.

### 9.2 DNS rollback (sau cutover)

- Giảm TTL DNS xuống 60s trước cutover 1 tuần.
- Nếu phát sinh lỗi nghiêm trọng trong 24h đầu → revert DNS về WordPress legacy.
- Sau 24h: fix forward, không rollback DNS (dữ liệu đã phân kỳ).

### 9.3 Migration rollback

Xem [DATABASE_MIGRATION_PLAN.md#10-rollback-plan](DATABASE_MIGRATION_PLAN.md#10-rollback-plan).

---

## 10. Log locations

| Service | Trong container | Ship đi đâu |
|---|---|---|
| nginx | `/var/log/nginx/access.log`, `/var/log/nginx/error.log` | Loki / CloudWatch |
| main-fe | stdout/stderr (JSON) | docker logs → Loki |
| admin-fe | stdout/stderr | docker logs → Loki |
| api | stdout (Pino/Logback) | docker logs → Loki; Sentry cho error |
| postgres | `/var/log/postgresql/*.log` | Loki |
| redis | stdout | docker logs |
| migration scripts | `migration/logs/YYYY-MM-DD.log` | persistent volume |

Log retention 30 ngày trong Loki; 1 năm trong cold storage nếu cần audit.

---

## 11. Health check

| Endpoint | Trả về |
|---|---|
| main-fe `/api/health` | `{"status":"ok","version":"..."}` |
| admin-fe `/api/health` | `{"status":"ok"}` |
| api `/actuator/health` (Spring) hoặc `/health` (Nest) | `{"status":"UP"}` + DB + Redis |
| nginx `/nginx-health` | 200 |

Docker Compose health check trong `docker-compose.yml`:

```yaml
services:
  api:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

Uptime monitor (UptimeRobot/BetterStack): ping 1 phút.

---

## 12. Secret management

- `.env.*` files gitignored.
- Secret cho production lưu trong Doppler / AWS Secrets Manager / HashiCorp Vault (chọn 1).
- Rotate khi có nhân sự rời đi.
- **Cảnh báo:** `wp-config.php` trong snapshot chứa DB password + AUTH salt plaintext — rotate toàn bộ trước khi deploy môi trường mới. Xem [PERMISSION_MATRIX.md §6 G4](PERMISSION_MATRIX.md#6-top-security-gaps-ranked).

---

## 13. Deploy checklist

### 13.1 Pre-deploy

- [ ] Run full test suite (xem [TESTING_GUIDE.md](TESTING_GUIDE.md)).
- [ ] Merge PR `develop` → `main` sau approval.
- [ ] Tag release `v1.x.y` (semver).
- [ ] Changelog cập nhật.
- [ ] Backup DB + media.
- [ ] Verify staging ổn định 24h.

### 13.2 Deploy main-fe / admin-fe

- [ ] CI build + push image.
- [ ] SSH vào production host.
- [ ] `git pull` repo `infra/`.
- [ ] `docker compose pull`.
- [ ] `docker compose up -d --no-deps main-fe`.
- [ ] Smoke test (xem [TESTING_GUIDE.md §6](TESTING_GUIDE.md#6-smoke-test-sau-deploy-production)).
- [ ] Monitor Sentry 10 phút sau deploy.

### 13.3 Deploy backend

- [ ] Run DB migration (Flyway/Prisma migrate) trên staging, sau đó production.
- [ ] `docker compose up -d --no-deps api`.
- [ ] `curl https://api.bigbike.vn/health`.
- [ ] Chạy contract test smoke.

### 13.4 Post-deploy

- [ ] Verify 5 URL mẫu (home, shop, product, cart, login).
- [ ] Verify sitemap.xml cập nhật.
- [ ] Check GTM events hoạt động (inspect devtools).
- [ ] Kiểm tra rate 4xx/5xx 30 phút đầu.
- [ ] Báo team qua Slack/Zalo.

### 13.5 Cutover production (chỉ cho launch)

Xem [URL_REDIRECT_MAP.md §7 checklist trước cutover](URL_REDIRECT_MAP.md#7-checklist-trước-cutover).

- [ ] Giảm TTL DNS 7 ngày trước.
- [ ] Lock WordPress admin (không cho edit content mới).
- [ ] Final delta migration (`updated_at > last_run`).
- [ ] Switch DNS → new infra.
- [ ] Monitor 72h intensive.
- [ ] Submit sitemap mới lên Google Search Console + Bing Webmaster.
- [ ] Ping Google via IndexNow (nếu dùng Bing/Yandex).
- [ ] Giữ WordPress legacy chạy đọc-only 30 ngày làm backup.

---

## 14. Scaling notes (phase sau)

- Khi CPU web > 70% sustained → thêm instance main-fe/api, gắn sau load balancer (HAProxy hoặc Cloudflare LB).
- Khi DB connections > 70% pool → tuning pool + read replica.
- Khi Redis memory > 70% → tăng plan hoặc eviction policy.

Không áp dụng phase 1 nếu traffic < 1M pageview/tháng.

---

## 15. Disaster recovery

| Tình huống | Action |
|---|---|
| VPS primary down | Failover sang standby: Cloudflare LB với 2 origin hoặc DNS failover |
| DB corruption | Restore dump gần nhất; nếu dùng managed Postgres → PITR |
| Media storage mất | Restore từ backup S3 |
| Datacenter Cloudflare outage | Tạm switch sang origin trực tiếp |
| DDoS | Cloudflare "I'm under attack" mode; rate-limit tier mạnh hơn |
| Ransomware | Restore snapshot cold storage |

---

## 16. Legal / compliance

- GDPR-like với khách VN: cookie banner (Google Analytics analytics cookie); chính sách bảo mật `/chinh-sach-bao-mat/` (NEEDS_CONFIRMATION có tồn tại page này).
- Data retention: order 5 năm theo luật thuế VN, log 1 năm.
- PII anonymize trong staging (email, phone, address, name).

---

## 17. Runbook nhanh cho ops

Tham khảo khi có sự cố:

| Triệu chứng | Check |
|---|---|
| main-fe 5xx | `docker compose logs main-fe` → check Sentry → check upstream API status |
| API 5xx | `docker compose logs api` → check DB connection / Redis / heap |
| DB lag | `SELECT * FROM pg_stat_activity WHERE state != 'idle'` → kill long query |
| Image broken 404 | `curl -I https://bigbike.vn/wp-content/uploads/…` → check nginx proxy rule → check upstream S3/legacy |
| Rate limit false-positive | Check Redis key `rl:*`; điều chỉnh threshold |
| SEO drop | Check GSC coverage report; diff sitemap URLs |
| Email không gửi | Check SMTP credentials; check SPF/DKIM; Sentry logs |
