# ADMIN_REQUIREMENTS.md — admin-fe

Yêu cầu chức năng cho admin site thay thế `/wp-admin/`. **Không bao gồm thiết kế giao diện.**

Nguồn: [WORKFLOW.md](WORKFLOW.md), [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md), [CONTENT_MODEL.md](CONTENT_MODEL.md).

---

## 1. Phạm vi

admin-fe là SPA độc lập (deploy subdomain, ví dụ `admin.bigbike.vn`), chỉ truy cập qua HTTPS + auth, tương tác với backend/API.

Các module chính:

1. Auth (login, 2FA optional, change password)
2. Dashboard (thống kê cơ bản)
3. Products (+ variation + attribute + brand + category + tag)
4. Orders
5. Customers (users + role)
6. Content — Pages, Blog posts, Blog categories/tags, Videos, Reviews, Sliders (nếu giữ)
7. Media library
8. Menu
9. SEO — metadata per entity, Redirects, Sitemap
10. Coupons
11. Settings — site info, payment, shipping, i18n strings (Polylang replacement)
12. Audit log
13. Import/Migration tools

---

## 2. Bảng module

| Module | Actions | Fields chính | Permissions | Validation | Notes |
|---|---|---|---|---|---|
| **Auth** | Login, Logout, Change password, Forgot password, Setup 2FA | email/username, password, totp_code | All authenticated | password ≥ 12, re-type, rate limit | JWT + refresh |
| **Dashboard** | Read-only KPI cards | revenue today/7d/30d, orders today, pending orders, low stock, new customers | ADMIN, SHOP_MANAGER | — | Query-based; no CRUD |
| **Product / Variation** | List, Filter, Create, Edit, Duplicate, Delete, Bulk publish/unpublish, Export CSV | slug, name, SKU, type, description, short_description, regular_price, sale_price, stock_status, manage_stock, stock_quantity, categories[], brand, tags[], primary_category, attributes (variation-generating), featured_image, gallery, content_bottom, rating_display, SEO meta | ADMIN, SHOP_MANAGER | SKU unique, slug unique, price ≥ 0, sale_price ≤ regular_price, stock int ≥ 0 | Variation sub-table; attribute builder |
| **Product category** | List tree, Create, Edit, Move, Delete | name, slug, parent, description, image, top_image, image_left, content_bottom, order, show_on_homepage, SEO meta | ADMIN, SHOP_MANAGER | slug unique/locale | Hierarchical drag-drop |
| **Brand (pwb-brand)** | List, Create, Edit, Delete | name, slug, description, logo, SEO meta | ADMIN, SHOP_MANAGER | slug unique | |
| **Attribute (pa_*)** | List, Create, Edit, Delete | code, name, kind (select/color/numeric), is_variation, values[] (slug, label, color_hex/swatch_image for pa_color) | ADMIN | code unique | |
| **Product tag** | List, Create, Edit, Delete | name, slug | ADMIN, SHOP_MANAGER | |
| **Orders (HPOS)** | List, Filter, Detail, Edit status, Add note, Refund, Print (PDF), Email customer | id, order_number, status, customer_id, total, currency, billing, shipping, line_items, shipping_items, fee_items, coupons, notes, payment_method, transaction_id, order_key | ADMIN, SHOP_MANAGER | status transition rule (xem STATE_MACHINES SM-04) | Quick-buy flag highlight (synthetic_user) |
| **Order note** | Add, List, Type (private/customer) | content, type, is_customer_email, created_by | ADMIN, SHOP_MANAGER | — | Audit trail |
| **Users** | List, Filter, Create, Edit, Delete (soft), Reset password, Change role, Impersonate (restricted) | login, email, display_name, first_name, last_name, phone, gender, dob, roles[], status, addresses, is_synthetic | ADMIN for CRUD; SHOP_MANAGER read customers | email unique, login unique, phone 10 digits khi publish | Quick-buy users có flag `is_synthetic` |
| **Pages** | List tree, Create, Edit, Publish/Draft, Delete, Preview | title, slug, content_html, parent, template_key (home/about/guide/contact/static/cart/checkout/login/register/profile/news), status, extra JSONB (ACF-like), SEO | ADMIN, EDITOR | slug unique | Template-specific ACF fields |
| **Blog posts** | List, Filter, Create, Edit, Publish/Schedule/Draft, Delete, Preview | title, slug, content_html, excerpt, categories[], tags[], author, featured_image, status, published_at, SEO | ADMIN, EDITOR | slug unique | Hỗ trợ schedule |
| **Blog category / tag** | List, Create, Edit, Delete | name, slug, description, parent, SEO | ADMIN, EDITOR | slug unique | |
| **Videos (CPT)** | List, Create, Edit, Delete | title, slug, youtube_id, thumbnail, description, product_id, published_at, SEO | ADMIN, EDITOR | | Auto-extract youtube_id từ URL |
| **Reviews (CPT)** | List, Create, Edit, Delete | title, slug, content_html, rating, author_name, product_id, image, published_at, SEO | ADMIN, EDITOR | | |
| **Sliders (Home page section)** | Edit ACF `sliders` on page_id=12 | repeater: image, image_mobile, product (ref), link | ADMIN, EDITOR | ≤ 10 slides | Không phải entity riêng |
| **Media** | Upload, List, Filter (type/date), Search, Edit (alt/title/caption/description), Delete (soft), Bulk | file, mime_type, size, dimensions, alt_text, title, caption, description, tags | ADMIN, EDITOR | size limit (10MB default), mime allowlist | Trỏ tới `media` entity; xem MEDIA_ASSET_INVENTORY.md |
| **Menu** | List, Create, Edit structure (drag-drop tree), Delete | menu name, location (primary/footer/guide), items (type, target_type, target_id hoặc external url, sort_order, parent_id, open_in_new_tab, css_classes) | ADMIN | location unique per menu | Xem ARCHITECTURE §5.3 |
| **SEO — per entity** | Edit inline trong form entity | meta_title, meta_description, focus_keyword, canonical_url, og_image, og_title, og_description, twitter_card, robots (index/noindex, follow/nofollow), jsonld_override | ADMIN, EDITOR | meta_title ≤ 60 chars warning, description ≤ 160 | Phát cảnh báo nhưng không block |
| **Redirects** | List, Create, Edit, Delete, Import CSV | sources (pattern + type glob/regex/exact), target, status_code (301/302/307/410), is_active, hit_count, last_hit_at | ADMIN | Không cho phép cycle A→B→A | Import từ `kd_rank_math_redirections` |
| **Sitemap** | View, Force regenerate | — | ADMIN | | |
| **Coupons** | List, Create, Edit, Delete | code, discount_type (percent/fixed_cart/fixed_product), amount, expires_at, usage_limit, min_order_amount, applies_to_products[], excluded_products[], applies_to_categories[] | ADMIN, SHOP_MANAGER | code unique, percent 0–100 | |
| **Settings — Site info** | Edit | site name, logo, default og image, contact email, hotline, addresses, geo | ADMIN | — | |
| **Settings — Payment** | Edit | enabled gateways (BACS, COD, others), BACS account details (bank, account_number, account_name, instructions), COD description | ADMIN | | |
| **Settings — Shipping** | Zones list + methods per zone | zone_name, regions, methods (flexible_shipping_single with cost rules) | ADMIN | | Map từ WC shipping zones; quick-buy đang hard-code id 9 — cần config hóa |
| **Settings — i18n strings** | List + edit | key, context, translations per locale | ADMIN, EDITOR | | Thay `pll_register_string` trong theme hiện tại |
| **Settings — Checkout** | Edit | required fields, phone regex (10 digit), free shipping threshold (2M VND hard-coded hiện tại → configurable) | ADMIN | | |
| **Contact submissions** | List, Detail, Mark as read, Export CSV, Delete | submitted_at, form_id, payload JSONB, read_by | ADMIN, EDITOR | | Read-only từ CF7 migrate |
| **Audit log** | Read-only list với filter | actor_id, actor_email, action (create/update/delete/login/impersonate), entity_type, entity_id, before, after, ip_address, user_agent, created_at | ADMIN | | |
| **Import / Migration tools** | One-time jobs: import WordPress dump, rebuild sitemap, rebuild search index, re-link media | — | SUPER_ADMIN | | CLI hoặc UI trigger |

---

## 3. Validation rules tóm tắt

Được enforce cả client (UX) lẫn server (authoritative):

- Slug: `^[a-z0-9-]+$`, 1–150 chars, unique.
- Phone: `^[0-9]{10}$` khi nhập (có thể optional khi draft).
- Email: RFC-5322 + MX check optional.
- Password: ≥ 12 chars cho admin user (khác với customer ≥ 6).
- Price: decimal ≥ 0.
- Sale price ≤ regular price.
- Stock quantity: int ≥ 0.
- Meta title: cảnh báo > 60 chars.
- Meta description: cảnh báo > 160 chars.
- Upload: file size limit (default 10MB), mime allowlist (image/jpeg, png, webp, svg sanitized, gif; pdf cho downloadable).
- Redirect: không tạo cycle.
- Order status transition: theo SM-04.

---

## 4. Publish / draft / archive logic

| Entity | Trạng thái | Trigger |
|---|---|---|
| Product | `draft`, `pending`, `publish`, `private`, `trash` | Admin |
| Product | `stock_status` độc lập: `instock`, `outofstock`, `onbackorder` | Admin hoặc auto (manage_stock) |
| Page | `draft`, `publish`, `private` | Admin |
| Blog post | `draft`, `pending`, `publish`, `future` (scheduled), `private`, `trash` | Admin |
| Order | Xem SM-04 | Admin |
| User | `active`, `disabled`, `soft_deleted` | Admin |
| Menu | `active`, `inactive` | Admin |
| Media | `active`, `soft_deleted` | Admin |
| Coupon | `active`, `expired` (auto), `disabled` | Admin hoặc auto |

Soft delete cho Product/Page/BlogPost/Media: vẫn giữ record 30 ngày, có nút "Restore". Sau 30 ngày auto purge (configurable).

---

## 5. Media management

Yêu cầu:
- Drag-drop upload hoặc click.
- Preview inline, edit alt/title/caption.
- Filter theo type, date, attached/unattached.
- Search theo filename, title, alt.
- Bulk delete.
- Không cho phép upload file quá 10MB (configurable).
- SVG upload qua sanitize server.
- Re-link: khi xóa media được dùng, cảnh báo danh sách entity đang tham chiếu.

---

## 6. SEO metadata management

Yêu cầu:
- Inline trong form entity (Product, Page, Post, Category, Brand, Blog category, Tag).
- Fields: meta_title, meta_description, focus_keyword, canonical_url, og_image, og_title, og_description, twitter_card, robots flags, jsonld_override.
- Live preview Google snippet + Facebook/Twitter card.
- Character counter title/desc.
- Bulk edit SEO (select nhiều rows).

Redirect module riêng:
- List với filter theo source/target/status/hit_count.
- Create form: choose pattern type (exact/regex/glob), source, target, code.
- Bulk import CSV (source,target,code,active).
- Monitor 404 logs (tích hợp `kd_rank_math_404_logs` đã migrate) → "Create redirect from this 404".

---

## 7. Menu / navigation management

Yêu cầu:
- Drag-drop tree editor.
- Mỗi item có thể trỏ: page, product_category, brand, blog_category, product, external_url.
- CSS class, open_in_new_tab, icon (optional).
- Preview rendered menu trên desktop/mobile (conceptual, không thiết kế UI).
- Location: primary, footer, guide (theo `king_setup`).

---

## 8. User / role management

Xem [AUTH_RBAC.md](AUTH_RBAC.md).

Tối thiểu:
- CRUD user admin-fe (role ADMIN, EDITOR, SHOP_MANAGER, VIEWER).
- Read customer list (role CUSTOMER) — không cho tạo từ admin trừ khi explicitly.
- Đổi role user.
- Disable/enable account.
- Impersonate user (SUPER_ADMIN only, full audit log).

---

## 9. Audit log

Mọi thao tác mutation ghi log:
- Login success/fail.
- CRUD entity (diff before/after stored).
- Role change.
- Impersonate.
- Redirect / SEO change.
- Order status change.
- Settings change.

Log retention: 1 năm (configurable).

Export CSV theo filter.

---

## 10. Import / Migration tools

CLI + admin-fe trigger (SUPER_ADMIN only):

| Tool | Mục đích |
|---|---|
| `migrate:wordpress` | Chạy phase migration (xem [DATABASE_MIGRATION_PLAN.md](DATABASE_MIGRATION_PLAN.md)) |
| `migrate:delta-sync` | Chạy incremental sync cho `updated_at > {last_run}` |
| `reindex:search` | Rebuild search index (Meilisearch/Elastic/Postgres FTS) |
| `rebuild:sitemap` | Regen sitemap |
| `validate:migration` | Count check + integrity check |
| `recalc:media-dimensions` | Scan file, update width/height |
| `import:redirects` | Import CSV redirect |
| `export:products` | Export CSV catalog |
| `export:orders` | Export CSV theo date range |

---

## 11. Notifications admin

- Email admin khi: đơn hàng mới, đơn hàng failed, product low stock, contact submission mới, migration job done.
- Realtime badge trong admin-fe (WebSocket hoặc Server-Sent Events) cho đơn mới.

---

## 12. Dashboard KPIs

| Card | Giá trị | Source |
|---|---|---|
| Doanh thu hôm nay | sum(order.total) where status in (processing, completed) and created_at::date = today | DB |
| Đơn hàng hôm nay | count(order) | DB |
| Đơn pending | count(order) where status in (pending, processing) | DB |
| Sản phẩm hết hàng | count(product) where stock_status='outofstock' | DB |
| Khách hàng mới (7d) | count(user) where role='CUSTOMER' and created_at > now()-7d | DB |
| Contact submissions chưa đọc | count | DB |
| Active coupons | count | DB |
| 404s 24h | count từ `kd_rank_math_404_logs` migrate | DB |

---

## 13. Yêu cầu phi chức năng

- Chỉ access qua HTTPS + firewall (whitelist IP admin optional).
- Session idle timeout 30 phút (configurable).
- Max session 8 giờ.
- 2FA (TOTP) cho SUPER_ADMIN, ADMIN (configurable per user).
- Audit log không thể tự sửa / xóa qua UI (chỉ CLI với super_admin).
- Export mọi list lớn phải async (email link khi xong).
- Pagination default 50/page, max 200.

---

## 14. Không trong phạm vi

- Không có giao diện thiết kế trang (không phải page builder).
- Không có visual composer.
- Không tích hợp kênh bán hàng (Shopee/Lazada/Sendo) phase 1.
- Không WMS/POS phase 1.
- Không marketing automation.
