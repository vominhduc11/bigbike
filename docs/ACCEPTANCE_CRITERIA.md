# ACCEPTANCE_CRITERIA.md — bigbike.vn Migration

Tiêu chí nghiệm thu để coi việc migrate/rewrite sang Next.js + admin site là đạt. Mỗi tiêu chí phải **kiểm tra được** + có owner + có evidence.

Nguồn tham chiếu: mọi file trong `docs/`.

---

## Ký hiệu

- **PASS** — đã verify, evidence OK.
- **FAIL** — không đạt hoặc chưa verify.
- **N/A** — không áp dụng trong phase 1.
- **Owner** — người chịu trách nhiệm ký nghiệm thu.

---

## 1. Functional acceptance

### 1.1 Storefront (main-fe)

| # | Tiêu chí | Cách verify | Owner |
|---|---|---|---|
| F-01 | Home render đầy đủ section: slider, 3 featured product, 5 carousel product, category grid, 3 review, 3 blog, 5 video, 5 brand, content_bottom | Manual QA + Playwright E2E | FE lead |
| F-02 | Shop page: list ≥ 24 sản phẩm/page, có pagination | E2E | FE lead |
| F-03 | Product category, brand, tag page render đúng title + meta + list product | E2E + SEO test | FE lead |
| F-04 | Product detail: gallery, price, variation radio, add-to-cart, quick-buy, tabs (description, videos, thông số kỹ thuật), related products | E2E | FE lead |
| F-05 | Variation lookup chính xác: pick color + size → trả đúng variation_id và price | E2E | FE lead |
| F-06 | Add to cart (simple + variable) cập nhật mini-cart và `/gio-hang/` | E2E | FE lead |
| F-07 | Remove cart item, update quantity cập nhật total đúng | E2E | FE lead |
| F-08 | Quick-buy tạo đơn với CAPTCHA + rate limit, redirect order received | E2E | BE lead |
| F-09 | Standard checkout: guest + logged-in, validate phone 10 digits, tạo order với trạng thái mặc định | E2E | BE lead |
| F-10 | Order received emit GTM `purchase` | Manual (devtools dataLayer) | FE lead |
| F-11 | Login với phone OR email thành công; lỗi hiển thị đồng nhất không leak user enumeration | E2E + security review | BE lead |
| F-12 | Register validate phone duplicate, email duplicate, password rules; CAPTCHA bắt buộc | E2E | BE lead |
| F-13 | Update profile (fullname, gender, dob, password) yêu cầu CSRF; không CSRF từ external site | Security test | BE lead |
| F-14 | Lost password email link hợp lệ, reset thành công + redirect login | E2E | BE lead |
| F-15 | Contact form submit lưu DB + email admin nhận được | Manual | BE lead |
| F-16 | Search text Vietnamese + English match product title + product_cat + pwb-brand | E2E | BE lead |
| F-17 | Filter brand/color/gender/price/paged đúng URL + kết quả | E2E | FE lead |
| F-18 | Blog listing + detail render đúng | E2E | FE lead |
| F-19 | My Account: orders, addresses, profile đều hoạt động | E2E | FE lead |
| F-20 | 404 page cho slug không tồn tại | Smoke | FE lead |

### 1.2 Admin (admin-fe)

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| A-01 | Admin login với 2FA (nếu enabled), idle timeout 30 phút | E2E | BE lead |
| A-02 | Dashboard hiển thị KPI (xem ADMIN_REQUIREMENTS §12) | Manual | FE lead |
| A-03 | CRUD Product + variation + attribute + category + brand + tag | E2E | FE lead |
| A-04 | CRUD Page + Blog post + Video + Review + Media + Menu | E2E | FE lead |
| A-05 | Order list, detail, change status, add note, export CSV | E2E | FE lead |
| A-06 | User list, change role, create EDITOR/SHOP_MANAGER | E2E | FE lead |
| A-07 | Redirect CRUD + import CSV | E2E | FE lead |
| A-08 | SEO metadata inline edit có live preview snippet | Manual | FE lead |
| A-09 | Media library upload, delete, edit alt/title | E2E | FE lead |
| A-10 | Coupon CRUD và apply được trên main-fe | E2E | FE lead |
| A-11 | Settings: payment, shipping, i18n strings | Manual | BE lead |
| A-12 | Audit log ghi mọi mutation + không sửa được qua UI | Code review + manual | BE lead |
| A-13 | On-demand ISR revalidate khi admin edit entity | E2E (edit → refresh main-fe) | FE lead |

---

## 2. SEO acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| S-01 | 100% product, page, blog publish có `<title>` + `<meta description>` không rỗng | SEO automated test | SEO lead |
| S-02 | Canonical URL đúng cho mọi route public | SEO test | SEO lead |
| S-03 | OG tags (title, description, image, type, url) đủ cho mọi route public | SEO test | SEO lead |
| S-04 | Twitter card `summary_large_image` có cho mọi route | SEO test | SEO lead |
| S-05 | JSON-LD hợp lệ: Organization + WebSite trên home; Product + Breadcrumb trên product detail; Article + Breadcrumb trên blog | Google Rich Results Test | SEO lead |
| S-06 | `robots.txt` ở `/robots.txt` trả 200, có `Sitemap:` directive | Smoke | Ops lead |
| S-07 | `/sitemap.xml` index hợp lệ, tất cả sub-sitemap dưới 50k URL | `xmllint` + count | SEO lead |
| S-08 | Sitemap cover 100% product, page, blog, category, brand publish | Diff query DB vs sitemap | SEO lead |
| S-09 | `noindex` trên cart, checkout, account, login, register, lost-password, search | SEO test | SEO lead |
| S-10 | hreflang emit đúng nếu xuất bản > 1 ngôn ngữ | SEO test | SEO lead |
| S-11 | Không emit rating cosmetic sai lệch (theo quyết định stakeholder) | Manual review | Business |
| S-12 | Breadcrumb HTML + JSON-LD cho product, blog, category | SEO test | FE lead |
| S-13 | PageSpeed Insights mobile ≥ 85 score cho home + product detail | Lighthouse CI | FE lead |
| S-14 | Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms ở 75th percentile | Field data (CrUX) sau 30 ngày | Ops lead |

---

## 3. URL redirect acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| R-01 | 100% URL trong `/wp-content/uploads/*` reachable | Crawl + curl batch | Ops lead |
| R-02 | 100% URL `/product/{slug}/`, `/danh-muc-san-pham/{slug}/`, `/pwb-brand/{slug}/`, `/tin-tuc/{slug}.html` đã tồn tại trong DB cũ đều có route trên main-fe | Crawl + diff | Migration lead |
| R-03 | URL cũ `/home/` 301 → `/` | curl | Ops lead |
| R-04 | `/wp-admin/*`, `/wp-login.php`, `/wp-json/*`, `/xmlrpc.php`, `/feed/*` trả 410 hoặc 403 | curl | Ops lead |
| R-05 | Sitemap cũ `/sitemap_index.xml` 301 → `/sitemap.xml` | curl | SEO lead |
| R-06 | Sub-sitemap pattern `{type}-sitemap.xml` 301 → `/sitemap-{type}.xml` | curl | SEO lead |
| R-07 | 301 không chain > 1 hop | Crawl | Ops lead |
| R-08 | Không có URL SEO-critical nào trả 404 hay 302 | Crawl | SEO lead |
| R-09 | Import `kd_rank_math_redirections` đầy đủ vào table Redirect mới | Count match | Migration lead |
| R-10 | 404 rate 72h đầu post-launch < 0.5% traffic | GSC + log | Ops lead |
| R-11 | Query filter URL (`?pwb-brand=...`) giữ nguyên format | E2E + manual | FE lead |
| R-12 | Không open redirect (validate target URL trong redirect param) | Security test | Security |

---

## 4. Content migration acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| C-01 | Count post-migration match snapshot (product 21,678; variation 4,040; blog 1,877; page 80; video 69; review 3; slider 2; attachment 12,054; order 1,061 ± HPOS dedup) | SQL count | Migration lead |
| C-02 | Sample 100 product random: title, SKU, price, stock, categories, brand, thumbnail match | Spot check | Migration lead |
| C-03 | Sample 50 blog post: title, content, featured image, categories match | Spot check | Migration lead |
| C-04 | Sample 20 order: total, line_items, billing+shipping address match | Spot check | Migration lead |
| C-05 | User migrate với role map đúng (administrator→ADMIN, shop_manager→SHOP_MANAGER, subscriber→CUSTOMER, synthetic users→CUSTOMER is_synthetic=true) | SQL check | Migration lead |
| C-06 | Menu render đúng 3 location (primary, footer, guide) với items + target resolve | Manual + E2E | FE lead |
| C-07 | SEO meta migrate: sample 100 product/post/page có `meta_title` + `meta_description` từ RankMath hoặc Yoast fallback | SQL check + manual | SEO lead |
| C-08 | ACF fields on home (sliders, about_us, blog_content, content_bottom) render đúng trên main-fe | Manual | FE lead |
| C-09 | ACF fields on contact (contact_form, iframe_maps, note) render đúng | Manual | FE lead |
| C-10 | ACF fields on product category (top_image, image_left, content_bottom) render đúng | Manual | FE lead |
| C-11 | `pwb-brand` logo render đúng ở home carousel + brand page | Manual | FE lead |
| C-12 | `pa_color` swatch hiển thị hex/image đúng theo ACF term | Manual | FE lead |
| C-13 | Coupon active migrate và áp được trên checkout | E2E | BE lead |
| C-14 | Contact form hoạt động (form CF7 id=1 recreate) | E2E | BE lead |
| C-15 | Polylang translations nếu migrate (phase 1 chỉ `vi`) | N/A phase 1 | — |

---

## 5. Media migration acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| M-01 | Tổng size media trên storage mới ≥ 99% của 8 GB nguồn (cho phép lệch do file ZIP/system) | `du -sh` diff | Migration lead |
| M-02 | Media count trong DB mới ≥ 11,900 (99% của 12,054) | SQL count | Migration lead |
| M-03 | `/wp-content/uploads/YYYY/MM/*` reachable từ browser với status 200 (sample 100 URL) | curl batch | Ops lead |
| M-04 | Alt text trên product image = product name (theo theme rule hiện tại) | Spot check | Migration lead |
| M-05 | Featured image của product, blog, page link đúng FK | SQL integrity | Migration lead |
| M-06 | Media chưa dùng vẫn giữ (không prune phase 1) | SQL count | Migration lead |
| M-07 | Image lazy-load (`loading="lazy"` hoặc `next/image`) trên shop loop + blog list | Manual | FE lead |
| M-08 | AVIF/WebP được serve cho browser hỗ trợ | Manual (devtools network) | FE lead |
| M-09 | Responsive image srcset đúng cho `next/image` | Manual | FE lead |
| M-10 | Không broken image trong crawl Screaming Frog | Crawl report | Ops lead |

---

## 6. Admin CRUD acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| AC-01 | Create product → publish → xuất hiện main-fe sau revalidate ≤ 1 phút | E2E | FE lead |
| AC-02 | Edit product price → reflect trên main-fe sau revalidate | E2E | FE lead |
| AC-03 | Delete product → main-fe trả 404 sau revalidate | E2E | FE lead |
| AC-04 | Create blog post publish → xuất hiện `/tin-tuc/{slug}.html` | E2E | FE lead |
| AC-05 | Schedule blog post `published_at` tương lai → không public cho đến giờ | Cron verify | BE lead |
| AC-06 | Upload media → insert vào post HTML | E2E | FE lead |
| AC-07 | Create redirect → URL cũ trả 301 ngay | E2E | FE lead |
| AC-08 | Change order status pending → processing → WC email gửi (hoặc queued) | E2E | BE lead |
| AC-09 | Create coupon → apply được trên main-fe checkout | E2E | BE lead |
| AC-10 | Create user EDITOR → login thành công + thấy content module, không thấy product/order | E2E | FE lead |
| AC-11 | SHOP_MANAGER không truy cập được audit log / settings infra | Security test | Security |
| AC-12 | SEO metadata edit inline trên product/page → render đúng trên main-fe | E2E + SEO test | FE lead |
| AC-13 | Menu reorder drag-drop → render đúng thứ tự trên main-fe | E2E | FE lead |

---

## 7. Auth / RBAC acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| AUTH-01 | Admin login yêu cầu password ≥ 12 chars, fail lockout 5/15min | E2E | BE lead |
| AUTH-02 | SUPER_ADMIN setup 2FA bắt buộc sau 30 ngày | Manual | BE lead |
| AUTH-03 | JWT access token TTL 15 phút, refresh 7 ngày, rotate trên mỗi refresh | Unit + integration | BE lead |
| AUTH-04 | Customer session HttpOnly + Secure + SameSite=Lax (Strict cho `/tai-khoan/*`) | Inspect cookie | BE lead |
| AUTH-05 | Logout all devices revoke toàn bộ refresh token | E2E | BE lead |
| AUTH-06 | Password change force logout tất cả session | E2E | BE lead |
| AUTH-07 | RBAC enforce: EDITOR không PATCH được product, SHOP_MANAGER không DELETE user admin, CUSTOMER không xem order người khác | Integration test | BE lead |
| AUTH-08 | Customer sync từ WordPress có flag `is_synthetic` khi login match pattern | SQL check | Migration lead |
| AUTH-09 | Synthetic user không login được bằng password cho đến khi claim qua OTP phone | E2E | BE lead |
| AUTH-10 | CSRF bắt buộc cho mọi mutation endpoint; thiếu → 403 | Integration test | BE lead |
| AUTH-11 | Rate limit: login 10/5min/IP, quick-buy 3/min/IP, register 5/h/IP | Integration | BE lead |
| AUTH-12 | Lost-password error đồng nhất không leak user tồn tại hay không | E2E | BE lead |

---

## 8. API contract acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| API-01 | OpenAPI spec (springdoc / Nest Swagger) expose ở `/api-docs` trong dev, không trong prod | Manual | BE lead |
| API-02 | Client SDK (packages/sdk) được sinh từ OpenAPI và CI fail nếu drift | CI | BE lead |
| API-03 | Mọi endpoint mutation đòi hỏi auth hoặc CAPTCHA rõ ràng (không `wp_ajax_nopriv_` pattern) | Code review | Security |
| API-04 | Mọi endpoint trả error format RFC 7807 | Integration | BE lead |
| API-05 | Response time P95: GET product detail < 400ms, GET shop < 500ms, POST checkout < 1.5s | k6 load test | BE lead |
| API-06 | OpenAPI include auth requirement, request/response schema, example | Manual | BE lead |
| API-07 | Versioning path `/api/v1/*`; phase 2 có thể introduce `/api/v2/*` | Convention | BE lead |
| API-08 | Không expose sensitive field (password_hash, TOTP secret, salt) trong response | Code review | Security |

---

## 9. Performance acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| P-01 | Lighthouse mobile ≥ 85 Performance score cho home, shop, product detail, blog detail | Lighthouse CI | FE lead |
| P-02 | Lighthouse SEO = 100 | Lighthouse CI | FE lead |
| P-03 | Lighthouse Accessibility ≥ 90 | Lighthouse CI | FE lead |
| P-04 | JS bundle initial route main-fe < 180KB gzipped | Bundle analyzer | FE lead |
| P-05 | TTFB home < 600ms (từ CDN edge) | RUM / synthetic | Ops lead |
| P-06 | API P95 latency < target (xem API-05) | k6 | BE lead |
| P-07 | CDN cache hit rate > 80% cho static assets + media | CDN analytics | Ops lead |
| P-08 | Image serve AVIF/WebP khi browser hỗ trợ | DevTools | FE lead |
| P-09 | No layout shift > 0.1 trên home + product | Lighthouse | FE lead |
| P-10 | Load test: 200 concurrent browse, P95 < 1s, error rate 0 | k6 | Ops lead |

---

## 10. Security acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| SEC-01 | OWASP ZAP baseline scan không có High severity finding | ZAP | Security |
| SEC-02 | `npm audit --prod` và `mvn dependency-check` không có CVE Critical chưa fix | CI | Security |
| SEC-03 | Mọi secret không commit trong repo (gitleaks) | CI | Security |
| SEC-04 | DB password + auth salt khác hoàn toàn với snapshot | Manual | Ops lead |
| SEC-05 | HTTPS only, HSTS enabled, cert auto-renew | Smoke | Ops lead |
| SEC-06 | CSP enabled, không `unsafe-inline` trừ GTM | Manual | Security |
| SEC-07 | Cookie flags: HttpOnly + Secure + SameSite đúng | DevTools | Security |
| SEC-08 | File upload block file thực thi (.php, .exe, .sh); SVG sanitize | Integration test | Security |
| SEC-09 | CAPTCHA hoạt động trên register, quick-buy, contact, forgot password | E2E | BE lead |
| SEC-10 | Audit log không sửa được qua UI; chỉ CLI super admin xóa | Manual + code review | Security |
| SEC-11 | IP whitelist hoặc 2FA cho admin-fe (policy stakeholder) | Manual | Ops lead |
| SEC-12 | Không có endpoint `wp_ajax_nopriv_*` pattern trong backend mới | Code review | Security |
| SEC-13 | Không open redirect (validate redirect target) | Security test | Security |
| SEC-14 | Rate limit enforce tại API + CDN | Manual test | Ops lead |

---

## 11. Deployment acceptance

| # | Tiêu chí | Verify | Owner |
|---|---|---|---|
| D-01 | Docker Compose production up đầy đủ services | `docker compose ps` | Ops lead |
| D-02 | Nginx reverse proxy config đúng (domain, TLS, proxy rules) | Manual | Ops lead |
| D-03 | Cloudflare SSL Full Strict, HSTS, DNS TTL phù hợp | Manual | Ops lead |
| D-04 | Health check endpoint trả 200 cho main-fe, admin-fe, api, nginx | curl | Ops lead |
| D-05 | Log ship Loki / CloudWatch, retention 30 ngày | Manual | Ops lead |
| D-06 | Sentry tích hợp FE + backend, project tách biệt | Manual | Ops lead |
| D-07 | Prometheus + Grafana dashboard có: request rate, latency, error rate, DB pool, Redis hit | Manual | Ops lead |
| D-08 | Backup DB daily + media weekly, retention đúng policy | Manual + drill | Ops lead |
| D-09 | Restore drill 1 quý thực hiện thành công | Manual | Ops lead |
| D-10 | Rollback plan viết rõ, test rollback trên staging | Manual | Ops lead |
| D-11 | CI/CD pipeline green từ lint → test → build → deploy | CI | Ops lead |
| D-12 | Smoke test post-deploy pass 100% URL mẫu | Script | Ops lead |
| D-13 | Alerting Slack/email khi 5xx rate > 1% trong 5 phút | Manual trigger | Ops lead |
| D-14 | Giữ WordPress legacy đọc-only 30 ngày sau cutover | Manual | Ops lead |
| D-15 | DNS cutover hoàn tất, không còn traffic lên WordPress public | Cloudflare analytics | Ops lead |

---

## 12. Business sign-off

| # | Tiêu chí | Stakeholder |
|---|---|---|
| B-01 | Không mất đơn hàng trong giai đoạn cutover | Business owner |
| B-02 | Không mất customer account hoặc lịch sử mua hàng | Business owner |
| B-03 | Giá, khuyến mãi, tồn kho hiển thị đúng theo admin | Business owner |
| B-04 | Không mất SEO traffic > 10% so với baseline 30 ngày trước launch | Business owner |
| B-05 | Admin vận hành đơn hàng quen thuộc sau training < 2 ngày | Business owner |
| B-06 | Không có sự cố bảo mật được báo cáo trong 30 ngày đầu | Business owner |
| B-07 | Uptime tháng đầu ≥ 99.5% | Business owner |
| B-08 | Ticket support < 5 issue critical trong 30 ngày đầu | Business owner |

---

## 13. Sign-off

Phase nghiệm thu yêu cầu:

1. Tất cả tiêu chí trên có trạng thái **PASS** hoặc **N/A** có justification.
2. Danh sách **FAIL** tồn tại phải được ghi nhận + có kế hoạch fix + deadline.
3. Owner của từng section xác nhận bằng chữ ký (hoặc ticket approval).
4. Stakeholder business ký nghiệm thu cuối cùng.

Không launch nếu còn **≥ 1 FAIL** trong các tiêu chí marked cao (F-01..F-20, S-*, R-*, AUTH-*, SEC-High).
