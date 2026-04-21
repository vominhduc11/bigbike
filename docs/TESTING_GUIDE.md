# TESTING_GUIDE.md — bigbike.vn Migration

Checklist và quy trình kiểm thử cho hệ thống mới. Áp dụng cả 3 app: main-fe, admin-fe, backend/api.

---

## 1. Cấu trúc test

| Loại test | Phạm vi | Công cụ |
|---|---|---|
| Lint | Tất cả code TypeScript/Java | ESLint + Prettier; Checkstyle cho Java |
| Typecheck | TS strict | `tsc --noEmit` |
| Unit | Hàm/utility/validator isolated | Vitest / Jest / JUnit 5 |
| Integration | API controllers + DB (Testcontainers) | Supertest / Testcontainers + RestAssured |
| E2E | Happy path user + admin | Playwright |
| Contract | OpenAPI/schema drift giữa FE và API | Dredd hoặc Schemathesis |
| SEO smoke | Title/desc/canonical/og/jsonld mỗi loại route | Playwright + @axe-core/playwright |
| Redirect | URL cũ → URL mới | Playwright script + curl batch |
| Sitemap/robots | Hợp lệ XML + URL truy cập được | xmllint + curl |
| Media broken link | Crawl `/wp-content/uploads/*` reference | Screaming Frog CLI hoặc `linkchecker` |
| Performance | LCP/CLS/INP | Lighthouse CI (mobile) |
| Security | OWASP ZAP baseline; dependency scan | ZAP + `npm audit` / `pnpm audit` / `mvn dependency-check` |
| Load | API throughput baseline | k6 |

---

## 2. Lệnh thực thi (đề xuất)

Các lệnh assumes monorepo pnpm + Spring Boot riêng. Điều chỉnh theo stack thật.

### 2.1 Lint

```bash
pnpm lint                       # eslint tất cả workspace
pnpm -F main-fe lint
pnpm -F admin-fe lint
cd api && mvn spotless:check    # nếu dùng Java
```

### 2.2 Typecheck

```bash
pnpm typecheck                  # tsc --noEmit tất cả workspace
pnpm -F main-fe typecheck
pnpm -F admin-fe typecheck
```

### 2.3 Unit test

```bash
pnpm test                       # vitest run all workspaces
pnpm -F main-fe test
pnpm -F admin-fe test
pnpm -F api test               # nếu NestJS
cd api && mvn test              # nếu Spring Boot
```

### 2.4 Integration test

```bash
# Backend
cd api
docker compose -f docker-compose.test.yml up -d  # Postgres + Redis test
mvn verify -Pintegration                          # hoặc pnpm test:integration
```

### 2.5 E2E

```bash
pnpm -F main-fe build && pnpm -F main-fe start & 
pnpm e2e:main                   # playwright test against main-fe
pnpm -F admin-fe build && pnpm -F admin-fe start & 
pnpm e2e:admin
```

### 2.6 Contract

```bash
# Generate OpenAPI từ backend, diff với client SDK
pnpm sdk:regenerate
git diff --exit-code packages/sdk   # CI fail nếu drift
```

### 2.7 SEO

```bash
pnpm e2e:seo                    # playwright spec check title/desc/canonical/og/jsonld
```

### 2.8 Redirect

```bash
pnpm scripts:redirect-check     # đọc CSV url_old,url_new,status_code, curl verify
```

### 2.9 Sitemap / robots

```bash
curl -s https://staging.bigbike.vn/robots.txt | grep "Sitemap:"
curl -s https://staging.bigbike.vn/sitemap.xml | xmllint --noout -
curl -s https://staging.bigbike.vn/sitemap-products.xml | xmllint --noout -
```

### 2.10 Broken link / image

```bash
# Screaming Frog CLI (license required) hoặc tương đương linkchecker
linkchecker --ignore-url=/tai-khoan --ignore-url=/gio-hang --ignore-url=/thanh-toan https://staging.bigbike.vn/
```

### 2.11 Performance

```bash
pnpm lhci:ci                    # lighthouse-ci (mobile config)
# Trên nhiều URL mẫu: home, shop, product detail, blog detail
```

### 2.12 Security

```bash
pnpm audit --prod
mvn dependency-check:check       # OWASP check Java deps
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://staging.bigbike.vn
```

### 2.13 Load (k6)

```bash
k6 run loadtests/shop-browse.js
k6 run loadtests/add-to-cart.js
k6 run loadtests/checkout.js
```

---

## 3. Test matrix theo loại

### 3.1 Unit test

Target coverage ≥ 60% phase 1, ≥ 80% phase 2. Bắt buộc với:

- Pure functions (slug, price formatter, phone normalizer).
- Validation schemas (Zod/Jakarta Validation).
- Migration helpers (php-unserialize, slug normalize, HTML sanitize).
- Reducer/state logic FE (cart, variation selector).

### 3.2 Integration test (backend)

Bắt buộc cover:

- Mọi API endpoint với ≥ 3 case: happy path, 4xx, 5xx.
- Auth middleware (JWT valid/invalid/expired, CSRF missing).
- RBAC: từng role được phép / không được phép theo [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) + [AUTH_RBAC.md](AUTH_RBAC.md).
- Order status transition (SM-04): invalid transition bị reject.
- Quick-buy: CAPTCHA bắt buộc, rate-limit sau 3 req.
- Product variation lookup: match attribute chính xác / không match → error rõ ràng.
- Redirect middleware: cycle detection, pattern match (glob/regex/exact).
- Sitemap generation: output XML hợp lệ.
- CSRF token mismatch → 403.
- Rate limit exceed → 429.

### 3.3 E2E — main-fe

Happy path scenarios:

| Scenario | Steps |
|---|---|
| Guest browse home → shop → product → add-to-cart → checkout → order received | Full flow, verify GTM events |
| Guest quick-buy | Product detail → fill form → order received |
| Register → auto-login → profile update | |
| Login → cart persistence after login | |
| Logout → cart empty? (NEEDS_CONFIRMATION behavior) | |
| Lost password → email nhận link (mock) → reset → login | |
| Search "mu bao hiem" → kết quả product | |
| Filter by brand + color + price → URL query đúng | |
| Pagination shop page 2 | |
| Contact form submit | |
| 404 page cho slug không tồn tại | |
| Middleware redirect `/home/` → `/` | |

### 3.4 E2E — admin-fe

Happy path:

| Scenario | Role |
|---|---|
| Admin login → 2FA → dashboard | ADMIN |
| Create product → publish → visible on main-fe | ADMIN |
| Edit product price → ISR revalidate main-fe | ADMIN |
| Upload media → insert vào post | EDITOR |
| Create redirect → GET URL cũ trả 301 | ADMIN |
| Create coupon → apply on main-fe checkout | SHOP_MANAGER |
| Change order status pending → processing | SHOP_MANAGER |
| Export orders CSV | SHOP_MANAGER |
| Create user with role EDITOR → login thành công | ADMIN |
| Change site setting BACS account → main-fe checkout hiển thị | ADMIN |

### 3.5 Contract test

- OpenAPI schema khai báo bởi backend.
- Script `sdk:regenerate` sinh client TS.
- CI fail nếu client drift với FE sử dụng thực tế.

### 3.6 SEO test (must-pass trước launch)

Cho mỗi loại route (home, shop, category, brand, product, blog-post, static):

- [ ] `<title>` không rỗng, ≤ 60 chars (khuyến cáo), match data expected.
- [ ] `<meta name="description">` không rỗng, ≤ 160 chars.
- [ ] `<link rel="canonical">` đúng URL.
- [ ] `<meta property="og:title/description/image/url/type">` hợp lệ.
- [ ] `<meta name="twitter:card">` = summary_large_image.
- [ ] JSON-LD block hợp lệ JSON, schema đúng:
  - Home: Organization + WebSite
  - Product: Product + AggregateRating (nếu emit) + BreadcrumbList
  - Blog: Article + BreadcrumbList
  - Category: BreadcrumbList
- [ ] `hreflang` nếu có nhiều ngôn ngữ.
- [ ] `robots noindex, nofollow` cho cart/checkout/account/search/login/register/lost-password.
- [ ] HTML có `<h1>` duy nhất.

### 3.7 Redirect test

Bắt buộc trước cutover:

- [ ] Crawl URL list (từ GSC export + Screaming Frog) → 200 hoặc 301 đến URL hợp lệ.
- [ ] 301 không chain > 1 hop.
- [ ] Không 302 cho URL SEO-critical.
- [ ] 404 rate < 0.5% traffic mẫu.
- [ ] `/home/` → `/` status 301.
- [ ] Query string filter URL giữ nguyên format.
- [ ] `/wp-content/uploads/*` truy cập được (proxy hoạt động).
- [ ] `/wp-admin/*`, `/wp-login.php`, `/xmlrpc.php`, `/wp-json/*` block hoặc 410.

### 3.8 Sitemap / robots test

- [ ] `/robots.txt` trả 200, có `Sitemap:` directive.
- [ ] `/sitemap.xml` hợp lệ XML.
- [ ] Mỗi sub-sitemap hợp lệ XML, ≤ 50,000 URL.
- [ ] URL trong sitemap khớp với entity có `status=publish` + `is_indexable=true`.
- [ ] Không include cart/checkout/account/search.
- [ ] Timestamp `lastmod` hợp lệ ISO 8601.
- [ ] Tổng URL = sum per sub-sitemap.

### 3.9 Migration validation test

Áp dụng trên staging với DB đã import:

- [ ] Count match theo [DATABASE_MIGRATION_PLAN.md §9.1](DATABASE_MIGRATION_PLAN.md#91-count-check).
- [ ] Integrity check: không orphan FK.
- [ ] Spot-check 100 product / 50 post / 20 order / 10 menu item.
- [ ] SEO meta không rỗng với ≥ 95% product/post (allow 5% có ý định để trống).
- [ ] Media coverage: 95%+ DB media có file trên disk.
- [ ] Redirect import count khớp với `kd_rank_math_redirections` active rows.
- [ ] User count khớp `kd_users`.
- [ ] Order total sum khớp WC reports.

### 3.10 Broken link / image check

- [ ] Crawl full site, `404` rate = 0 nội bộ.
- [ ] Mọi `<img src>` trả 200.
- [ ] External link không có dead link (warning only).

### 3.11 Performance (Lighthouse)

Target cho home, shop, product detail, blog detail trên config mobile (slow 4G):

| Metric | Mobile target |
|---|---|
| Performance score | ≥ 85 |
| Accessibility | ≥ 90 |
| Best Practices | ≥ 90 |
| SEO | 100 |
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| TBT | < 300ms |

Chạy qua Lighthouse CI gắn vào pipeline. Fail build nếu regression > 5 điểm so với baseline.

### 3.12 Security baseline

- [ ] ZAP baseline scan: không có High severity finding.
- [ ] Mọi endpoint mutation có CSRF token check.
- [ ] Mọi admin endpoint có RBAC check.
- [ ] Không leak stack trace trong production error.
- [ ] HTTPS only, HSTS enabled.
- [ ] Cookie flags đúng (HttpOnly, Secure, SameSite).
- [ ] CSP không có `unsafe-inline` trừ nơi bắt buộc (GTM).
- [ ] Dependency scan không có CVE critical.
- [ ] Secret không commit (git-secrets, gitleaks).

### 3.13 Load test baseline

| Scenario | Target |
|---|---|
| 50 concurrent user browse shop | P95 latency < 1s |
| 30 concurrent add-to-cart | P95 < 500ms, error rate 0 |
| 10 concurrent checkout | P95 < 1.5s, error rate 0 |
| 200 concurrent search query | P95 < 800ms |

---

## 4. CI pipeline (đề xuất)

```
.github/workflows/ci.yml:
  jobs:
    lint:
      run: pnpm lint
    typecheck:
      run: pnpm typecheck
    unit:
      run: pnpm test -- --coverage
    integration-api:
      services: postgres, redis
      run: pnpm -F api test:integration
    e2e-main:
      run: pnpm -F main-fe build && playwright test e2e/main
    e2e-admin:
      run: pnpm -F admin-fe build && playwright test e2e/admin
    lighthouse:
      run: pnpm lhci:ci
    security:
      run: pnpm audit && zap-baseline
```

Block merge vào `main` nếu bất kỳ job fail.

---

## 5. Manual QA checklist trước launch

Kiểm tra thủ công bổ sung (không tự động hóa hết được):

- [ ] Form CF7 submit đúng → email nhận tin.
- [ ] Quick-buy với CAPTCHA: pass → đơn hàng tạo; fail → rejected.
- [ ] Order received page load GTM purchase event (check dataLayer).
- [ ] Variation picker: khi pick color out-of-stock, button disabled đúng.
- [ ] Variation picker: reset button clear selection.
- [ ] Mini-cart badge đúng count sau add/remove.
- [ ] Locale vi-VN cho datetime hiển thị đúng.
- [ ] Giá VND format `1.234.567 đ` (BR-12).
- [ ] Brand logo hiển thị đúng trên home carousel.
- [ ] Footer menu đúng location.
- [ ] Breadcrumb đúng hierarchy.
- [ ] Logo click → về `/`.
- [ ] Search icon → input inline.
- [ ] Responsive mobile (320px, 375px, 414px, 768px, 1024px).
- [ ] Dark/light mode (nếu có — NEEDS_CONFIRMATION).
- [ ] Contact form field file upload (nếu có).

---

## 6. Smoke test sau deploy production

Ngay sau mỗi release, chạy trong 10 phút:

```bash
pnpm smoke:prod   # chứa:
#   curl -f https://bigbike.vn/
#   curl -f https://bigbike.vn/robots.txt
#   curl -f https://bigbike.vn/sitemap.xml
#   curl -f https://bigbike.vn/product/{sample-slug}/
#   curl -f https://bigbike.vn/danh-muc-san-pham/{sample-slug}/
#   curl -fI https://bigbike.vn/home/ | grep "301"
#   curl -fI https://bigbike.vn/wp-admin/ | grep -E "403|404|301"
```

Mọi curl fail → alert Slack + auto rollback.

---

## 7. Test data

- **Fixture** product/category/user/order cho unit + integration: JSON seed.
- **Staging DB** là snapshot ẩn danh từ production (anonymize PII: email, phone, address, name).
- **Test user accounts:** `testadmin@bigbike.vn` (ADMIN), `testshop@bigbike.vn` (SHOP_MANAGER), `testeditor@bigbike.vn` (EDITOR), `testcustomer@bigbike.vn` (CUSTOMER).

---

## 8. Regression sanity

Sau mỗi PR ảnh hưởng migration script hoặc API route:

- [ ] Chạy lại migration validate trên staging DB.
- [ ] Chạy lại contract test.
- [ ] Chạy lại SEO smoke 10 URL mẫu.

---

## 9. Tài liệu tham chiếu

- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md) — tiêu chí nghiệm thu cuối cùng.
- [AUTH_RBAC.md](AUTH_RBAC.md) — phân quyền cần test.
- [SEO_MIGRATION.md](SEO_MIGRATION.md) — check list SEO.
- [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md) — test plan redirect.
- [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md) — validation sau migration.
