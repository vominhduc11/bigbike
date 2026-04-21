# PROJECT_OVERVIEW.md — bigbike.vn Migration

Tổng quan dự án rewrite từ WordPress + WooCommerce sang kiến trúc tách lớp: **main-fe (Next.js)** + **admin-fe** + **backend/API**.

> Tài liệu này là điểm vào. Chi tiết kỹ thuật nằm ở các tài liệu khác trong `docs/`.

---

## 1. Bối cảnh hiện tại

- Hệ thống hiện tại: WordPress **6.9.4** monolith + WooCommerce + 26 plugin active (array `active_plugins` có 26 phần tử thực tế, index bị thiếu 16 — NEEDS_CONFIRMATION plugin nào đã remove). Chi tiết đầy đủ xem [ARCHITECTURE.md](ARCHITECTURE.md).
- Database prefix: `kd_`. MySQL trên shared hosting Plesk.
- Ngôn ngữ chính: tiếng Việt (Polylang, nhưng prefix `vi/` và `en/` đã ngừng phát hành — tất cả URL có prefix đều 301 về URL root).
- Media: ~8.0 GB trong `wp-content/uploads/` (2014 → 2026), **12,053 attachment** (verified).
- Khối lượng nội dung đã verify từ dump:
  - **1,227** product publish + draft (chưa tính revisions)
  - **4,040** product_variation
  - **174** blog post
  - **22** page (không phải 80 như ghi trước)
  - **825** shop_order (HPOS tắt — legacy là source-of-truth)
  - **62** video (CPT Pods "Videos", pod id 7920)
  - **2** slider (CPT, nguồn đăng ký NEEDS_CONFIRMATION)
  - **0** review CPT (template `single-review.php` có thể dùng cho blog category, NEEDS_CONFIRMATION)
  - **46** nav_menu_item (3 menu location: primary=term 360, footer=term 368, guide=term 367)
  - **1** contact form (CF7 id=8895, 4 field: `your_name`, `your_email`, `your_phone`, `your_message`)
  - **3,997** user
- **HPOS chưa bật** — `woocommerce_custom_orders_table_enabled='no'`. Nguồn đơn hàng là `kd_posts` + `kd_postmeta` legacy, không phải `kd_wc_orders`.
- SEO: RankMath là engine chính (modules active: sitemap, rich-snippet, woocommerce, acf, redirections, 404-monitor, analytics, v.v.), nhưng theme vẫn đọc `_yoast_wpseo_*` (Yoast cũ) ở một số điểm — xem [DATA_CONTRACT.md#e-13](DATA_CONTRACT.md#e-13--seo--meta-fields) và [SEO_MIGRATION.md](SEO_MIGRATION.md).
- GTM container: **GTM-5BKZL3K** (verified header.php:150).
- Facebook page: `https://www.facebook.com/bigbikegear/`.
- URL structure thực tế (do Permalink Manager Pro override WC default):
  - Product: `/sp/{slug}.html`
  - Product category: `/{cat-slug}.html` hoặc `/{parent}/{child}.html` (hierarchical)
  - Brand: `/brand/{slug}.html`
  - Page: `/{slug}.html`
  - Blog post: `/tin-tuc/{slug}.html`
  - Shop listing root: `/danh-muc-san-pham.html`
  - Xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md) cho chi tiết.

---

## 2. Mục tiêu rewrite

1. Tách **storefront public** khỏi WordPress sang **Next.js** (main-fe) để: (a) tối ưu SEO (SSR/SSG/ISR), (b) nâng hiệu năng Core Web Vitals, (c) thoát khỏi 3 lớp cache đang chồng chéo của WordPress (W3TC + Autoptimize + WP Rocket residual).
2. Xây dựng **admin-fe** độc lập, quản lý sản phẩm / đơn hàng / bài viết / media / menu / SEO / redirect, thay thế dần `wp-admin`.
3. Xây dựng **backend/API** mới (hoặc dùng headless WordPress tạm thời trong phase chuyển tiếp — xem "Phương án tạm" §7).
4. **Giữ nguyên toàn bộ URL SEO-critical hiện có** (product, category, brand, blog `/tin-tuc/*.html`, page Vietnamese slugs). Xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md).
5. Không làm mất data: sản phẩm, đơn hàng, user, media, SEO meta.
6. Thay thế hoàn toàn 8 AJAX endpoint tùy biến hiện tại ([API_CONTRACT.md](API_CONTRACT.md)) bằng API có nonce/CSRF/rate-limit.

---

## 3. Phạm vi hệ thống mới

### main-fe (Next.js public site)

Chịu trách nhiệm render tất cả URL public:
- Trang chủ `/`
- Shop / category / brand / search
- Product detail `/product/{slug}/`
- Cart / Checkout / Order received
- Login / Register / Profile / Lost password
- Blog listing / detail `/tin-tuc/{slug}.html`
- Contact, Static pages (giới thiệu, hướng dẫn, v.v.)

Cơ chế render: SSG + ISR cho trang catalog, SSR cho cart/checkout/account. Chi tiết [MAIN_SITE_REQUIREMENTS.md](MAIN_SITE_REQUIREMENTS.md).

### admin-fe (admin site quản trị)

CRUD + quản lý nội dung và vận hành:
- Sản phẩm, danh mục, brand, attribute
- Đơn hàng (HPOS)
- Bài viết, trang tĩnh
- Media
- Menu
- SEO metadata + URL redirect
- User / role
- Settings (shipping, payment, tỷ giá, chuỗi tĩnh đa ngôn ngữ)

Chi tiết [ADMIN_REQUIREMENTS.md](ADMIN_REQUIREMENTS.md).

### backend / API

Cần có vì logic phức tạp (đơn hàng, thanh toán, inventory, giỏ hàng, auth) không nên ở client Next.js.

- Option A (khuyến nghị): Spring Boot hoặc NestJS làm API + PostgreSQL.
- Option B (tạm trong giai đoạn chuyển tiếp): giữ WordPress + WooCommerce làm "headless" qua REST/custom endpoints; Next.js consume → cho phép migrate từng module.
- Option C: Node.js/Express thuần + Prisma nếu team FE mạnh về JS.

Khuyến nghị: xem [TECH_STACK.md](TECH_STACK.md).

---

## 4. Phạm vi giữ lại từ WordPress

Trong giai đoạn chuyển tiếp (tối thiểu phase 1 và 2):

- **Nguồn dữ liệu tạm:** WooCommerce vẫn là source-of-truth cho đơn hàng và inventory cho đến khi backend mới sẵn sàng.
- **Admin tạm:** shop_manager tiếp tục dùng `/wp-admin/` để xử lý đơn hàng cho đến khi admin-fe thay thế hoàn toàn module Orders.
- **Content backfill:** bài viết và page tiếp tục edit trên wp-admin cho đến khi admin-fe thay thế.

Sau phase 3: chỉ giữ WordPress ở chế độ archive, không publish ra public.

---

## 5. Phạm vi KHÔNG migrate nếu không đủ dữ liệu

Các hạng mục hiện tại có bằng chứng mỏng; sẽ không migrate nếu không có dữ liệu rõ ràng:

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Nextend Social Login (Facebook) | Thư mục plugin tồn tại nhưng KHÔNG có trong `active_plugins` | Coi như đã tắt. Không migrate trừ khi stakeholder xác nhận. NEEDS_CONFIRMATION |
| Google Listings & Ads | Plugin active, tables `kd_gla_*` tồn tại | Cần OAuth credentials. Nếu không có, tạm không migrate. NEEDS_CONFIRMATION |
| Pods custom fields | Plugin active, có `kd_podsrel` | Cấu hình lưu trong options, chưa trích xuất. NEEDS_CONFIRMATION |
| Permalink Manager Pro | Plugin active, license có thể hết hạn trên môi trường mới | Rule set phải export riêng. NEEDS_CONFIRMATION |
| WP Rocket / WP Hummingbird config | Thư mục config còn sót nhưng plugin không active | Không migrate |
| Subscription / membership | Không phát hiện plugin nào active | Không trong phạm vi |
| Duplicator backups trong `wp-content/backups-dup-pro` | Artifact backup | Không migrate |
| Action Scheduler queue | Chỉ cần migrate job đang pending nếu có | NEEDS_CONFIRMATION — cần chạy `SELECT COUNT(*) FROM kd_actionscheduler_actions WHERE status='pending'` |

---

## 6. App/module chính

```
┌───────────────────────────────────────────────────────────┐
│                          Users                            │
└──────────────┬────────────────────────────┬───────────────┘
               │                            │
     ┌─────────▼─────────┐        ┌─────────▼─────────┐
     │   main-fe         │        │   admin-fe        │
     │   Next.js         │        │   Next.js/React   │
     │   (public SSR/ISR)│        │   (SPA, protected)│
     └─────────┬─────────┘        └─────────┬─────────┘
               │                            │
               └────────────┬───────────────┘
                            │ HTTPS
                  ┌─────────▼─────────┐
                  │   backend / API   │
                  │ Spring Boot / Nest│
                  │  (REST + auth)    │
                  └─────────┬─────────┘
                            │
            ┌───────────────┼────────────────┐
            │               │                │
     ┌──────▼─────┐  ┌──────▼──────┐  ┌──────▼──────┐
     │ PostgreSQL │  │  Redis      │  │  S3/MinIO    │
     │ (product,  │  │ (session,   │  │ (media)      │
     │  order,    │  │  cart,      │  │              │
     │  content)  │  │  cache)     │  │              │
     └────────────┘  └─────────────┘  └─────────────┘
```

Chi tiết stack: [TECH_STACK.md](TECH_STACK.md).

---

## 7. Phương án tạm (phase chuyển tiếp)

Nếu backend mới chưa sẵn sàng trước khi main-fe ra production, có thể triển khai **headless WordPress** tạm:

- WordPress tiếp tục chạy ở origin nội bộ (không public).
- main-fe gọi WordPress REST API + WooCommerce Store API để lấy dữ liệu.
- Main-fe override URL public. WordPress không còn trực tiếp phục vụ HTML cho user cuối.
- Từng module (product → order → content → auth) migrate dần sang backend mới.

Rủi ro: WooCommerce Store API cần nonce nếu gọi từ browser. Nếu main-fe là SSR, phải gọi server-to-server để tránh nonce.

---

## 8. Nguồn dữ liệu hiện tại

Chi tiết trong [DATA_CONTRACT.md](DATA_CONTRACT.md). Tóm tắt:

- `kd_posts` + `kd_postmeta`: product, product_variation, page, post, attachment, nav_menu_item, shop_order (legacy + HPOS sync).
- `kd_wc_orders` + `kd_wc_orders_meta` + `kd_wc_order_addresses` + `kd_wc_order_operational_data`: HPOS orders.
- `kd_users` + `kd_usermeta`: users.
- `kd_terms` + `kd_term_taxonomy` + `kd_termmeta`: categories, tags, `pwb-brand`, `pa_color`, `pa_size`.
- `kd_options`: cấu hình site, WC settings, permalinks, payment gateways.
- `kd_rank_math_*`: SEO data.
- `kd_yoast_*`: SEO data cũ (vẫn còn và vẫn được đọc trong code — xem [BUSINESS_RULES.md](BUSINESS_RULES.md) BR-14, BR-15).
- `kd_db7_forms`: contact form submissions.
- `kd_woocommerce_sessions`: cart session (không migrate).

---

## 9. Rủi ro migration

| # | Rủi ro | Mức độ | Đề xuất giảm thiểu |
|---|---|---|---|
| R1 | Mất URL SEO đã được Google index trong nhiều năm | Cao | Lock URL pattern (xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md)); 301 redirect triệt để; sitemap 1:1 |
| R2 | Mất meta title / description do chuyển engine SEO | Cao | Migrate cả `rank_math_*` lẫn `_yoast_wpseo_*` (xem [SEO_MIGRATION.md](SEO_MIGRATION.md)) |
| R3 | Media 8GB broken link | Cao | Giữ nguyên path `/wp-content/uploads/YYYY/MM/` hoặc dùng rewrite proxy; xem [MEDIA_ASSET_INVENTORY.md](MEDIA_ASSET_INVENTORY.md) |
| R4 | Quick Buy đang tạo đơn không nonce, dễ bị abuse | Cao | Bắt buộc CAPTCHA/rate-limit trên API mới. Xem [BUSINESS_RULES.md](BUSINESS_RULES.md) BR-20 |
| R5 | HPOS **tắt** (`woocommerce_custom_orders_table_enabled='no'`) — nguồn chính là legacy `kd_posts` | Trung | Migrate trực tiếp từ legacy, bỏ qua `kd_wc_orders*` tables |
| R6 | Cart session (WooCommerce sessions) không thể migrate | Thấp | Accept — cart rỗng lần đầu người dùng truy cập site mới |
| R7 | ACF + Pods custom fields chưa được export | Trung | Export ACF JSON + Pods config từ wp-admin trước khi tắt WordPress |
| R8 | Polylang translation mapping phức tạp | Trung | Chỉ support ngôn ngữ đang publish; phase 1 chỉ cần `vi` |
| R9 | Payment gateway BACS + COD phụ thuộc config WooCommerce | Trung | Xem [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md) — chép nguyên text hướng dẫn chuyển khoản |
| R10 | Flexible Shipping method id hard-code `flexible_shipping_single:9` | Trung | Xây cấu hình shipping mới; map 1:1 theo id hiện có |
| R11 | 3 lớp cache WordPress có thể serve stale HTML khi đang migrate | Cao | Flush W3TC + Autoptimize trước khi cắt DNS |
| R12 | User tạo bởi Quick Buy dùng login `<phone>@liveevil.vn` | Trung | Migrate nhưng đánh flag `synthetic_user=true`; không cho login cho đến khi verify phone |
| R13 | Hai lớp stock flag (`_stock_status` + `product_of_stock`) | Trung | Gộp về 1 field `is_in_stock` trong data model mới; warning nếu lệch |
| R14 | Thiếu data cho 1 contact form CF7 (đang là duy nhất) | Thấp | Recreate form config trong admin-fe |
| R15 | `wp-config.php` chứa salt + password plaintext trong snapshot | Cao | Rotate toàn bộ khi import; không commit snapshot vào git |

---

## 10. Quy tắc không làm mất SEO (bắt buộc)

1. Tất cả URL public hiện tại **KEEP_SAME_URL** hoặc **301** đến URL tương đương — không bao giờ 404 hay 302.
2. Mọi trang cần có `<title>`, `<meta description>`, `<link rel="canonical">`, Open Graph và Twitter Card không kém bản WordPress hiện tại.
3. Structured Data JSON-LD (AutoBodyShop org trên home, Product + AggregateRating trên product detail, breadcrumb, article trên blog) phải được duy trì. Xem [SEO_MIGRATION.md](SEO_MIGRATION.md).
4. Sitemap XML phải cover tất cả post type đang public (product, post, page, pwb-brand, product_cat).
5. Robots.txt hợp lệ (hiện WordPress sinh virtual; phải viết tay trong Next.js).
6. `hreflang` cho các bản dịch Polylang (nếu có ngôn ngữ thứ hai phát hành).

---

## 11. Quy tắc không làm mất content / media

1. Không delete bất kỳ record nào trong DB nguồn trước khi phase cuối nghiệm thu.
2. Mọi media URL `/wp-content/uploads/YYYY/MM/xxx.ext` phải truy cập được sau migration — hoặc giữ path, hoặc rewrite proxy.
3. Nội dung blog (HTML trong `post_content`) phải được làm sạch nhưng không mất ảnh và link.
4. Alt text được theme rewrite runtime (theo tiêu đề sản phẩm). Khi migrate, nếu `post_title` đổi, alt cũng đổi — cần tính đến.
5. Draft, pending, scheduled posts phải được migrate đúng trạng thái.

---

## 12. Liên kết nhanh đến các tài liệu khác

Phân tích hiện trạng:
- [ARCHITECTURE.md](ARCHITECTURE.md) — Kiến trúc WordPress hiện tại, request lifecycle, plugin map.
- [API_CONTRACT.md](API_CONTRACT.md) — 8 AJAX handler custom + các endpoint WC.
- [API_FLOW_MAP.md](API_FLOW_MAP.md) — Mọi flow URL → template → handler.
- [DATA_CONTRACT.md](DATA_CONTRACT.md) — Data model hiện tại.
- [BUSINESS_RULES.md](BUSINESS_RULES.md) — 31 business rule phát hiện trong source.
- [BUSINESS_PROCESS.md](BUSINESS_PROCESS.md) — 11 process vận hành.
- [WORKFLOW.md](WORKFLOW.md) — Workflow per actor.
- [STATE_MACHINES.md](STATE_MACHINES.md) — State machine entity.
- [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md) — Ai được làm gì. Hiện tên file đúng chuẩn là `PERMISSION_MATRIX.md`. Nếu dự án có nhắc tới `PERMISION_MATRIX.md` (thiếu 1 chữ `S`), nên đổi tên thành `PERMISSION_MATRIX.md` — **không tự đổi nếu chưa kiểm tra link nội bộ**.

Kế hoạch migration:
- [WORDPRESS_AUDIT.md](WORDPRESS_AUDIT.md)
- [PAGE_INVENTORY.md](PAGE_INVENTORY.md)
- [CONTENT_MODEL.md](CONTENT_MODEL.md)
- [SEO_MIGRATION.md](SEO_MIGRATION.md)
- [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md)
- [MEDIA_ASSET_INVENTORY.md](MEDIA_ASSET_INVENTORY.md)
- [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md)

Yêu cầu hệ thống mới:
- [MAIN_SITE_REQUIREMENTS.md](MAIN_SITE_REQUIREMENTS.md)
- [ADMIN_REQUIREMENTS.md](ADMIN_REQUIREMENTS.md)
- [AUTH_RBAC.md](AUTH_RBAC.md)
- [TECH_STACK.md](TECH_STACK.md)

Quy trình vận hành:
- [TESTING_GUIDE.md](TESTING_GUIDE.md)
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- [ACCEPTANCE_CRITERIA.md](ACCEPTANCE_CRITERIA.md)
