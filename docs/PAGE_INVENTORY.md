# PAGE_INVENTORY.md — bigbike.vn

Inventory tất cả page cần xử lý khi migrate sang Next.js public site.

Nguồn dữ liệu:
- Theme templates: `files/wp-content/themes/bigbike/page-templates/*.php`.
- `kd_options` page-id bindings: `woocommerce_shop_page_id=1` (Shop), `woocommerce_cart_page_id=2` (Cart), `woocommerce_checkout_page_id=3` (Checkout), `woocommerce_myaccount_page_id=4` (My Account).
- Polylang post id references trong theme: 7968 (register), 7970 (login), 10155 (lost password), 361/365 (blog categories), 287 (product_cat km).
- Trang id 12 "Trang chủ" với `post_name='home'` (từ sqldump `kd_posts`).
- Slug page đã verify từ SQL: `home`, `gio-hang` (id 2), `thanh-toan` (id 3), `tai-khoan` (id 4), `san-pham` (id 1, title "Tất cả sản phẩm"), `dang-nhap`, `dang-ky`, `lien-he`, `gioi-thieu`, `huong-dan`, `huong-dan-mua-hang` (id 11), `quen-mat-khau`, `video` (`_pods_pod` id 7920, không phải page).
- **URL thực tế (verified từ `kd_rank_math_redirections` + `permalink-manager_uris`):**
  - Permalink Manager Pro override URL theo pattern:
    - Page: `/{slug}.html` (`%pagename%.html`)
    - Product: `/sp/{slug}.html` (`sp/%postname%.html`)
    - Product category: `/{cat-slug}.html` hoặc `/{parent}/{child}.html` (`%product_cat%.html` hierarchical)
    - Brand (`pwb-brand`): `/brand/{slug}.html`
    - Video CPT: `/video/{slug}.html` hoặc `/{video_slug}/{video}.html`
    - Blog post: `/tin-tuc/{slug}.html` (theo `permalink_structure` WP)
    - Blog category: `/{category}.html`
  - Shop listing root: `/danh-muc-san-pham.html` (URL đích trong nhiều redirect) — chính là page id=1 slug=`san-pham` được rewrite.
- **Tổng số `page` post_type publish trong DB: 22** (verified count). Số 80 trong bản trước là đếm nhầm literal match.

---

## 1. Public pages — quan trọng nhất

| Page Name | Old URL | Type | Template / Source | Data Source | SEO Required | Admin Manageable | Notes |
|---|---|---|---|---|---|---|---|
| Trang chủ | `/` | Static landing | [page-home.php](files/wp-content/themes/bigbike/page-templates/page-home.php) | ACF fields page_id=12 + featured products + brands + blogs + videos | **Có** (Organization + WebSite SearchAction JSON-LD trong header.php) | Có (ACF) | Nhiều section phụ thuộc ACF. Home page id 12 slug `home`; URL `/home.html` trong guid cũ nhưng redirect về `/`. |
| Shop listing | `/danh-muc-san-pham.html` (page_id=1, slug `san-pham`) | Archive | [archive-product.php](files/wp-content/themes/bigbike/woocommerce/archive-product.php) | WooCommerce products | **Có** | Partial (SEO via RankMath) | URL verified từ target nhiều redirect row. Title override `custom_document_title` theo query filter. |
| Product category | `/{cat-slug}.html` hoặc `/{parent}/{child}.html` | Archive | [taxonomy-product_cat.php](files/wp-content/themes/bigbike/woocommerce/taxonomy-product_cat.php) | `product_cat` term + products | **Có** | Có | VD `/mu-bao-hiem.html`, `/ao-quan-bao-ho/ao-bao-ho-vai-textile-jackets.html`. ACF `top_image`, `image_left`, `content_bottom`. |
| Brand listing | `/brand/{slug}.html` | Archive | [taxonomy-pwb-brand.php](files/wp-content/themes/bigbike/woocommerce/taxonomy-pwb-brand.php) | Perfect WooCommerce Brands + products | **Có** | Có | Pattern verified trong `permalink-manager_uris`. VD `/brand/agv.html`. |
| Search | `/?s={q}` hoặc `/?s={q}&post_type=product` | Dynamic | [search.php](files/wp-content/themes/bigbike/search.php) + filter `posts_search` | WP search with cat+brand expansion | Noindex, canonical force về `/` | Không | Search logic phức tạp [BUSINESS_RULES.md#br-10](BUSINESS_RULES.md#br-10--search-covers-product-title--product_cat--pwb-brand-names). |
| Product detail | `/sp/{slug}.html` | Dynamic | [single-product.php](files/wp-content/themes/bigbike/woocommerce/single-product.php) → [content-single-product.php](files/wp-content/themes/bigbike/woocommerce/content-single-product.php) | Product + variations + ACF | **Có** (Product itemprop microdata + ratingValue/reviewCount cosmetic) | Có | **1,227** product publish (đã verify lại — không phải 21,678). VD `/sp/giay-di-moto-phuot-tcx-ro4d-waterproof.html`. |
| Cart | `/gio-hang.html` (page_id=2, slug `gio-hang`) | Dynamic | [page-cart.php](files/wp-content/themes/bigbike/page-templates/page-cart.php) → `[woocommerce_cart]` → [cart.php](files/wp-content/themes/bigbike/woocommerce/cart/cart.php) | WC cart session | Noindex | Không | GTM `view_cart`. `post_content` verified có shortcode `[woocommerce_cart]`. |
| Checkout | `/thanh-toan.html` (page_id=3, slug `thanh-toan`) | Dynamic | [page-checkout.php](files/wp-content/themes/bigbike/page-templates/page-checkout.php) → `[woocommerce_checkout]` → [form-checkout.php](files/wp-content/themes/bigbike/woocommerce/checkout/form-checkout.php) | WC checkout | Noindex | Không | `post_content` verified có shortcode `[woocommerce_checkout]`. Custom phone 10-digit validation. |
| Order received | `/thanh-toan/order-received/{id}?key=...` | Dynamic | [thankyou.php](files/wp-content/themes/bigbike/woocommerce/checkout/thankyou.php) | WC_Order legacy (HPOS tắt) | Noindex | Không | GTM `purchase`. Hard-code path trong API-07. |
| Login | `/dang-nhap.html` (page_id=7970, slug `dang-nhap`) | Form | [page-login.php](files/wp-content/themes/bigbike/page-templates/page-login.php) | — | Noindex | Partial (page content only) | Custom AJAX `custom_login_user`. |
| Register | `/dang-ky.html` (page_id=7968, slug `dang-ky`) | Form | [page-register.php](files/wp-content/themes/bigbike/page-templates/page-register.php) | — | Noindex | Partial | Custom AJAX `custom_register_user`. |
| Lost password | `/quen-mat-khau.html` (page_id=10155, slug `quen-mat-khau`) | Form | page-static hoặc page-template có `[lost_password_form]` shortcode | — | Noindex | Partial | Template chính xác NEEDS_CONFIRMATION. |
| My Account | `/tai-khoan.html` (page_id=4, slug `tai-khoan`) | Dynamic | [my-account.php](files/wp-content/themes/bigbike/woocommerce/myaccount/my-account.php) (WC tabs) | Current user | Noindex (auth-protected) | Không | WC shortcode `[woocommerce_my_account]`. |
| Profile | URL NEEDS_CONFIRMATION (có thể trùng `/tai-khoan.html` hoặc sub-route) | Form | [page-profile.php](files/wp-content/themes/bigbike/page-templates/page-profile.php) | Current user | Noindex | Có | Dùng custom AJAX `update_user_infomation`. |

---

## 2. Blog / news pages

| Page Name | Old URL | Type | Template | Data Source | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Blog listing (category "Tin tức") | `/{category-slug}.html` (theo Permalink Manager pattern `%category%.html`) | Archive | [category.php](files/wp-content/themes/bigbike/category.php) | `category` term (id 361 "Tin tức", id 365 "Trải nghiệm") | **Có** | Partial | **174 posts** (đã verify — không phải 1,877). Slug category cụ thể NEEDS_CONFIRMATION. |
| Blog post detail | `/tin-tuc/{slug}.html` | Dynamic | [single.php](files/wp-content/themes/bigbike/single.php) | Post | **Có** | Có | Per `permalink_structure='/tin-tuc/%postname%.html'`. VD `/tin-tuc/pinlock-la-gi.html` |
| Video detail | `/video/{slug}.html` (pattern `video/%postname%.html`) HOẶC `/{video_slug}/{video}.html` (pattern `%video_slug%/%video%.html`) | Dynamic | [single-video.php](files/wp-content/themes/bigbike/single-video.php) | CPT `video` pod "Videos" id 7920 | Có | Có (qua Pods admin + RankMath) | **62 video posts** (đã verify). 2 pattern URL cùng có trong `permalink-manager_uris` — NEEDS_CONFIRMATION variant đang live. |
| Review detail | NEEDS_CONFIRMATION | Dynamic | [single-review.php](files/wp-content/themes/bigbike/single-review.php) | Không có CPT `review` trong `kd_posts.post_type`. Có term `review` trong taxonomy. Template có thể dùng cho blog post trong category `review` (id NEEDS_CONFIRMATION). | NEEDS_CONFIRMATION | NEEDS_CONFIRMATION | Không có "3 items" như ghi trước — đó là term count, không phải CPT. |
| Blog landing page (page-news) | NEEDS_CONFIRMATION — file template chỉ có 1 dòng | Static | [page-news.php](files/wp-content/themes/bigbike/page-templates/page-news.php) | — | NEEDS_CONFIRMATION | NEEDS_CONFIRMATION | **Page template rỗng**; chưa thấy gán cho page nào. Có thể WIP hoặc unused. |

---

## 3. Static / policy pages

Từ slug đã verify trong dump và từ menu `nav_menu_item`. Đa số dùng template [page.php](files/wp-content/themes/bigbike/page.php) hoặc [page-static.php](files/wp-content/themes/bigbike/page-templates/page-static.php).

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Giới thiệu | `/gioi-thieu/` | Static | [page-about.php](files/wp-content/themes/bigbike/page-templates/page-about.php) | Page content + ACF (NEEDS_CONFIRMATION) | Có | Có | |
| Hướng dẫn | `/huong-dan/` | Static | [page-guide.php](files/wp-content/themes/bigbike/page-templates/page-guide.php) | Page content + menu `guide` (registered in `king_setup`) | Có | Có | Có menu secondary riêng |
| Tĩnh khác | NEEDS_CONFIRMATION (chính sách bảo mật / giao hàng / đổi trả / điều khoản…) | Static | [page-static.php](files/wp-content/themes/bigbike/page-templates/page-static.php) | Page content | Có | Có | Chưa verify slug trong dump — cần query `SELECT post_name FROM kd_posts WHERE post_type='page' AND post_status='publish'` |

Hành động đề xuất: export danh sách đầy đủ page publish từ DB trước khi migrate. Với dump: `SELECT ID, post_title, post_name, post_status FROM kd_posts WHERE post_type='page' AND post_status='publish' ORDER BY ID`.

---

## 4. Contact / form pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Liên hệ | `/lien-he/` | Static + form | [page-contact.php](files/wp-content/themes/bigbike/page-templates/page-contact.php) | Page content + ACF `contact_form`, `iframe_maps`, `note` | Có | Có | Form CF7 id NEEDS_CONFIRMATION |

---

## 5. Search / archive pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Search (all post types) | `/?s={q}` | Archive | [search.php](files/wp-content/themes/bigbike/search.php) | WP search | **Forced canonical to `/`** | Không | Auto-append ` s` cho single-word |
| Search (product-only) | `/?s={q}&post_type=product` | Archive | `archive-product.php` (WC) | WP search + custom filter | Tương tự | Không | |
| Shop filter by brand | `/shop/?pwb-brand={slug}` | Archive | `archive-product.php` | WP query | Có (title override) | Không | Xem [BUSINESS_RULES.md#br-15](BUSINESS_RULES.md#br-15--shop--category-title-reflects-current-filters) |
| Shop filter by color | `/shop/?filter_color={slug}` | Archive | `archive-product.php` | devvn + WC | Có | Không | |
| Shop filter by gender | `/shop/?filter_gender=nam\|nu` | Archive | `archive-product.php` | Custom filter | Có | Không | |
| Shop filter by price range | `/shop/?min_price=X&max_price=Y` | Archive | `archive-product.php` | devvn-woocommerce-price-filter | Có | Không | |
| Pagination | `/shop/page/N/` hoặc `?paged=N` | Archive | `archive-product.php` | WP_Query | Có | Không | `rel=next/prev` đã bị disable (xem [BUSINESS_RULES.md#br-17](BUSINESS_RULES.md#br-17--rel-next--rel-prev-disabled-on-listing-pages)) |

---

## 6. Special landing pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Slider (CPT) | UNKNOWN — 2 items CPT `slider`, chỉ được tiêu thụ bởi home page | n/a | Không template single rõ ràng | ACF fields | Không | NEEDS_CONFIRMATION | Chỉ làm nguồn data cho home carousel |

---

## 7. Auth-protected / account pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| My Account Dashboard | `/tai-khoan/` (WC tab mặc định) | Dynamic | [my-account.php](files/wp-content/themes/bigbike/woocommerce/myaccount/my-account.php) → [dashboard.php](files/wp-content/themes/bigbike/woocommerce/myaccount/dashboard.php) | Current user | Noindex | Không | |
| My Orders | `/tai-khoan/orders/` | Dynamic | `woocommerce/myaccount/orders.php` + `my-orders.php` | Orders HPOS | Noindex | Không | |
| View order | `/tai-khoan/view-order/{id}/` | Dynamic | `woocommerce/myaccount/view-order.php` + `order/order-details.php` + `order-details-customer.php` | Order | Noindex | Không | |
| Edit account | `/tai-khoan/edit-account/` | Dynamic | `woocommerce/myaccount/form-edit-account.php` | Current user | Noindex | Không | |
| Edit address | `/tai-khoan/edit-address/{billing\|shipping}/` | Dynamic | `woocommerce/myaccount/form-edit-address.php` + `my-address.php` | User meta | Noindex | Không | |
| Downloads | `/tai-khoan/downloads/` | Dynamic | `woocommerce/myaccount/downloads.php` + `my-downloads.php` | (nếu có sản phẩm downloadable — NEEDS_CONFIRMATION) | Noindex | Không | Không chắc có dùng |
| Payment methods | `/tai-khoan/payment-methods/` | Dynamic | `woocommerce/myaccount/payment-methods.php` | Payment tokens | Noindex | Không | Với BACS+COD, feature này NEEDS_CONFIRMATION |
| Reset password | `/my-account/lost-password/?action=rp&key=...` | Dynamic | `woocommerce/myaccount/form-reset-password.php` + `form-lost-password.php` | — | Noindex | Không | Custom redirect sau reset |

---

## 8. 404 / error pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| 404 | (any unknown) | Error | [404.php](files/wp-content/themes/bigbike/404.php) | — | Noindex | Không | Nội dung NEEDS_CONFIRMATION |

---

## 9. Admin-only pages (không render công khai)

| Page | Notes |
|---|---|
| `/wp-admin/` | Trang admin mặc định WordPress; sẽ thay thế bằng admin-fe sau migration |
| `/wp-login.php` | Login admin; giữ tạm, ẩn trên public DNS sau khi admin-fe live |

---

## 10. Menu cấu trúc (`nav_menu_item` count=46)

Theme đăng ký 3 menu location ([functions.php:42-46](files/wp-content/themes/bigbike/functions.php#L42-L46)):
- `primary` — Header menu
- `footer` — Footer menu
- `guide` — Menu secondary cho trang hướng dẫn

Nội dung menu thực tế NEEDS_CONFIRMATION — cần query `kd_term_taxonomy` where taxonomy='nav_menu' và join `kd_term_relationships` + `kd_postmeta` (_menu_item_*).

---

## 11. Danh sách chưa verify hoàn toàn

- URL `/shop/` — shop_page_id=1 nhưng chưa verify slug. Có thể là `/shop` hoặc URL Việt hóa.
- URL các page chính sách: `/chinh-sach-bao-mat/`, `/chinh-sach-doi-tra/`, `/chinh-sach-giao-hang/`, `/dieu-khoan/` (suy đoán). NEEDS_CONFIRMATION.
- `/video/{slug}` — cần kiểm tra permalink rule cho CPT `video`.
- `/review/{slug}` — tương tự.
- `/hdsd/` hoặc sub-path của `/huong-dan/` — NEEDS_CONFIRMATION.
- Tất cả 80 page trong DB cần được liệt kê đầy đủ. Lệnh truy xuất: `SELECT ID, post_name, post_title, post_status, post_parent FROM kd_posts WHERE post_type='page' ORDER BY post_name`.

---

## 12. Summary counts

| Loại | Số lượng (verified từ dump) | Ưu tiên migrate |
|---|---|---|
| Product | **1,227** | Cao |
| Product variation | 4,040 | Cao |
| Blog post | **174** | Trung |
| Page | **22** | Cao |
| Video (CPT, Pods-generated) | **62** | Thấp (khách hàng xác định) |
| Review (CPT) | **0** — không phải CPT riêng. Nếu nội dung review nằm trong blog category → gộp chung với blog post | — |
| Slider (CPT) | 2 | Trung (làm source cho home) |
| Shop order (legacy HPOS tắt) | **825** | Cao |
| Shop coupon | 1 | Thấp |
| Contact form CF7 | 1 (id 8895) | Cao (recreate form shape: your_name/email/phone/message) |
| Menu items | 46 | Trung (recreate) |
| Attachment | 12,053 | Cao (media migration) |
| Users | 3,997 (verified) | Cao |
