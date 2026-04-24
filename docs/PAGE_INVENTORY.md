# PAGE_INVENTORY.md â€” bigbike.vn

Inventory táº¥t cáº£ page cáº§n xá»­ lĂ½ khi migrate sang Next.js public site.

Nguá»“n dá»¯ liá»‡u:
- Theme templates: `files/wp-content/themes/bigbike/page-templates/*.php`.
- `kd_options` page-id bindings: `woocommerce_shop_page_id=1` (Shop), `woocommerce_cart_page_id=2` (Cart), `woocommerce_checkout_page_id=3` (Checkout), `woocommerce_myaccount_page_id=4` (My Account).
- Polylang post id references trong theme: 7968 (register), 7970 (login), 10155 (lost password), 361/365 (blog categories), 287 (product_cat km).
- Trang id 12 "Trang chá»§" vá»›i `post_name='home'` (tá»« sqldump `kd_posts`).
- Slug page Ä‘Ă£ verify tá»« SQL: `home`, `gio-hang` (id 2), `thanh-toan` (id 3), `tai-khoan` (id 4), `san-pham` (id 1, title "Táº¥t cáº£ sáº£n pháº©m"), `dang-nhap`, `dang-ky`, `lien-he`, `gioi-thieu`, `huong-dan`, `huong-dan-mua-hang` (id 11), `quen-mat-khau`, `video` (`_pods_pod` id 7920, khĂ´ng pháº£i page).
- **URL thá»±c táº¿ (verified tá»« `kd_rank_math_redirections` + `permalink-manager_uris`):**
  - Permalink Manager Pro override URL theo pattern:
    - Page: `/{slug}.html` (`%pagename%.html`)
    - Product: `/sp/{slug}.html` (`sp/%postname%.html`)
    - Product category: `/{cat-slug}.html` hoáº·c `/{parent}/{child}.html` (`%product_cat%.html` hierarchical)
    - Brand (`pwb-brand`): `/brand/{slug}.html`
    - Video CPT: `/video/{slug}.html` hoáº·c `/{video_slug}/{video}.html`
    - Blog post: `/tin-tuc/{slug}.html` (theo `permalink_structure` WP)
    - Blog category: `/{category}.html`
  - Shop listing root: `/danh-muc-san-pham.html` (URL Ä‘Ă­ch trong nhiá»u redirect) â€” chĂ­nh lĂ  page id=1 slug=`san-pham` Ä‘Æ°á»£c rewrite.
- **Tá»•ng sá»‘ `page` post_type publish trong DB: 22** (verified count). Sá»‘ 80 trong báº£n trÆ°á»›c lĂ  Ä‘áº¿m nháº§m literal match.

---

## 1. Public pages â€” quan trá»ng nháº¥t

| Page Name | Old URL | Type | Template / Source | Data Source | SEO Required | Admin Manageable | Notes |
|---|---|---|---|---|---|---|---|
| Trang chá»§ | `/` | Static landing | [page-home.php](files/wp-content/themes/bigbike/page-templates/page-home.php) | ACF fields page_id=12 + featured products + brands + blogs + videos | **CĂ³** (Organization + WebSite SearchAction JSON-LD trong header.php) | CĂ³ (ACF) | Nhiá»u section phá»¥ thuá»™c ACF. Home page id 12 slug `home`; URL `/home.html` trong guid cÅ© nhÆ°ng redirect vá» `/`. |
| Shop listing | `/danh-muc-san-pham.html` (page_id=1, slug `san-pham`) | Archive | [archive-product.php](files/wp-content/themes/bigbike/woocommerce/archive-product.php) | WooCommerce products | **CĂ³** | Partial (SEO via RankMath) | URL verified tá»« target nhiá»u redirect row. Title override `custom_document_title` theo query filter. |
| Product category | `/{cat-slug}.html` hoáº·c `/{parent}/{child}.html` | Archive | [taxonomy-product_cat.php](files/wp-content/themes/bigbike/woocommerce/taxonomy-product_cat.php) | `product_cat` term + products | **CĂ³** | CĂ³ | VD `/mu-bao-hiem.html`, `/ao-quan-bao-ho/ao-bao-ho-vai-textile-jackets.html`. ACF `top_image`, `image_left`, `content_bottom`. |
| Brand listing | `/brand/{slug}.html` | Archive | [taxonomy-pwb-brand.php](files/wp-content/themes/bigbike/woocommerce/taxonomy-pwb-brand.php) | Perfect WooCommerce Brands + products | **CĂ³** | CĂ³ | Pattern verified trong `permalink-manager_uris`. VD `/brand/agv.html`. |
| Search | `/?s={q}` hoáº·c `/?s={q}&post_type=product` | Dynamic | [search.php](files/wp-content/themes/bigbike/search.php) + filter `posts_search` | WP search with cat+brand expansion | Noindex, canonical force vá» `/` | KhĂ´ng | Search logic phá»©c táº¡p [BUSINESS_RULES.md#br-10](BUSINESS_RULES.md#br-10--search-covers-product-title--product_cat--pwb-brand-names). |
| Product detail | `/sp/{slug}.html` | Dynamic | [single-product.php](files/wp-content/themes/bigbike/woocommerce/single-product.php) â†’ [content-single-product.php](files/wp-content/themes/bigbike/woocommerce/content-single-product.php) | Product + variations + ACF | **CĂ³** (Product itemprop microdata + ratingValue/reviewCount cosmetic) | CĂ³ | **1,227** product publish (Ä‘Ă£ verify láº¡i â€” khĂ´ng pháº£i 21,678). VD `/sp/giay-di-moto-phuot-tcx-ro4d-waterproof.html`. |
| Cart | `/gio-hang.html` (page_id=2, slug `gio-hang`) | Dynamic | [page-cart.php](files/wp-content/themes/bigbike/page-templates/page-cart.php) â†’ `[woocommerce_cart]` â†’ [cart.php](files/wp-content/themes/bigbike/woocommerce/cart/cart.php) | WC cart session | Noindex | KhĂ´ng | GTM `view_cart`. `post_content` verified cĂ³ shortcode `[woocommerce_cart]`. |
| Checkout | `/thanh-toan.html` (page_id=3, slug `thanh-toan`) | Dynamic | [page-checkout.php](files/wp-content/themes/bigbike/page-templates/page-checkout.php) â†’ `[woocommerce_checkout]` â†’ [form-checkout.php](files/wp-content/themes/bigbike/woocommerce/checkout/form-checkout.php) | WC checkout | Noindex | KhĂ´ng | `post_content` verified cĂ³ shortcode `[woocommerce_checkout]`. Custom phone 10-digit validation. |
| Order received | `/thanh-toan/order-received/{id}?key=...` | Dynamic | [thankyou.php](files/wp-content/themes/bigbike/woocommerce/checkout/thankyou.php) | WC_Order legacy (HPOS táº¯t) | Noindex | KhĂ´ng | GTM `purchase`. Hard-code path trong API-07. |
| Login | `/dang-nhap.html` (page_id=7970, slug `dang-nhap`) | Form | [page-login.php](files/wp-content/themes/bigbike/page-templates/page-login.php) | â€” | Noindex | Partial (page content only) | Custom AJAX `custom_login_user`. |
| Register | `/dang-ky.html` (page_id=7968, slug `dang-ky`) | Form | [page-register.php](files/wp-content/themes/bigbike/page-templates/page-register.php) | â€” | Noindex | Partial | Custom AJAX `custom_register_user`. |
| Lost password | `/quen-mat-khau.html` (page_id=10155, slug `quen-mat-khau`) | Form | BigBike web route `/quen-mat-khau` + backend reset token flow | — | Noindex | Yes | Request mode + `?token=` reset mode. |
| My Account | `/tai-khoan.html` (page_id=4, slug `tai-khoan`) | Dynamic | [my-account.php](files/wp-content/themes/bigbike/woocommerce/myaccount/my-account.php) (WC tabs) | Current user | Noindex (auth-protected) | KhĂ´ng | WC shortcode `[woocommerce_my_account]`. |
| Profile | URL NEEDS_CONFIRMATION (cĂ³ thá»ƒ trĂ¹ng `/tai-khoan.html` hoáº·c sub-route) | Form | [page-profile.php](files/wp-content/themes/bigbike/page-templates/page-profile.php) | Current user | Noindex | CĂ³ | DĂ¹ng custom AJAX `update_user_infomation`. |

---

## 2. Blog / news pages

| Page Name | Old URL | Type | Template | Data Source | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Blog listing (category "Tin tá»©c") | `/{category-slug}.html` (theo Permalink Manager pattern `%category%.html`) | Archive | [category.php](files/wp-content/themes/bigbike/category.php) | `category` term (id 361 "Tin tá»©c", id 365 "Tráº£i nghiá»‡m") | **CĂ³** | Partial | **174 posts** (Ä‘Ă£ verify â€” khĂ´ng pháº£i 1,877). Slug category cá»¥ thá»ƒ NEEDS_CONFIRMATION. |
| Blog post detail | `/tin-tuc/{slug}.html` | Dynamic | [single.php](files/wp-content/themes/bigbike/single.php) | Post | **CĂ³** | CĂ³ | Per `permalink_structure='/tin-tuc/%postname%.html'`. VD `/tin-tuc/pinlock-la-gi.html` |
| Video detail | `/video/{slug}.html` (pattern `video/%postname%.html`) HOáº¶C `/{video_slug}/{video}.html` (pattern `%video_slug%/%video%.html`) | Dynamic | [single-video.php](files/wp-content/themes/bigbike/single-video.php) | CPT `video` pod "Videos" id 7920 | CĂ³ | CĂ³ (qua Pods admin + RankMath) | **62 video posts** (Ä‘Ă£ verify). 2 pattern URL cĂ¹ng cĂ³ trong `permalink-manager_uris` â€” NEEDS_CONFIRMATION variant Ä‘ang live. |
| Review detail | NEEDS_CONFIRMATION | Dynamic | [single-review.php](files/wp-content/themes/bigbike/single-review.php) | KhĂ´ng cĂ³ CPT `review` trong `kd_posts.post_type`. CĂ³ term `review` trong taxonomy. Template cĂ³ thá»ƒ dĂ¹ng cho blog post trong category `review` (id NEEDS_CONFIRMATION). | NEEDS_CONFIRMATION | NEEDS_CONFIRMATION | KhĂ´ng cĂ³ "3 items" nhÆ° ghi trÆ°á»›c â€” Ä‘Ă³ lĂ  term count, khĂ´ng pháº£i CPT. |
| Blog landing page (page-news) | NEEDS_CONFIRMATION â€” file template chá»‰ cĂ³ 1 dĂ²ng | Static | [page-news.php](files/wp-content/themes/bigbike/page-templates/page-news.php) | â€” | NEEDS_CONFIRMATION | NEEDS_CONFIRMATION | **Page template rá»—ng**; chÆ°a tháº¥y gĂ¡n cho page nĂ o. CĂ³ thá»ƒ WIP hoáº·c unused. |

---

## 3. Static / policy pages

Tá»« slug Ä‘Ă£ verify trong dump vĂ  tá»« menu `nav_menu_item`. Äa sá»‘ dĂ¹ng template [page.php](files/wp-content/themes/bigbike/page.php) hoáº·c [page-static.php](files/wp-content/themes/bigbike/page-templates/page-static.php).

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Giá»›i thiá»‡u | `/gioi-thieu/` | Static | [page-about.php](files/wp-content/themes/bigbike/page-templates/page-about.php) | Page content + ACF (NEEDS_CONFIRMATION) | CĂ³ | CĂ³ | |
| HÆ°á»›ng dáº«n | `/huong-dan/` | Static | [page-guide.php](files/wp-content/themes/bigbike/page-templates/page-guide.php) | Page content + menu `guide` (registered in `king_setup`) | CĂ³ | CĂ³ | CĂ³ menu secondary riĂªng |
| TÄ©nh khĂ¡c | NEEDS_CONFIRMATION (chĂ­nh sĂ¡ch báº£o máº­t / giao hĂ ng / Ä‘á»•i tráº£ / Ä‘iá»u khoáº£nâ€¦) | Static | [page-static.php](files/wp-content/themes/bigbike/page-templates/page-static.php) | Page content | CĂ³ | CĂ³ | ChÆ°a verify slug trong dump â€” cáº§n query `SELECT post_name FROM kd_posts WHERE post_type='page' AND post_status='publish'` |

HĂ nh Ä‘á»™ng Ä‘á» xuáº¥t: export danh sĂ¡ch Ä‘áº§y Ä‘á»§ page publish tá»« DB trÆ°á»›c khi migrate. Vá»›i dump: `SELECT ID, post_title, post_name, post_status FROM kd_posts WHERE post_type='page' AND post_status='publish' ORDER BY ID`.

---

## 4. Contact / form pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| LiĂªn há»‡ | `/lien-he/` | Static + form | [page-contact.php](files/wp-content/themes/bigbike/page-templates/page-contact.php) | Page content + ACF `contact_form`, `iframe_maps`, `note` | CĂ³ | CĂ³ | Form CF7 id NEEDS_CONFIRMATION |

---

## 5. Search / archive pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Search (all post types) | `/?s={q}` | Archive | [search.php](files/wp-content/themes/bigbike/search.php) | WP search | **Forced canonical to `/`** | KhĂ´ng | Auto-append ` s` cho single-word |
| Search (product-only) | `/?s={q}&post_type=product` | Archive | `archive-product.php` (WC) | WP search + custom filter | TÆ°Æ¡ng tá»± | KhĂ´ng | |
| Shop filter by brand | `/shop/?pwb-brand={slug}` | Archive | `archive-product.php` | WP query | CĂ³ (title override) | KhĂ´ng | Xem [BUSINESS_RULES.md#br-15](BUSINESS_RULES.md#br-15--shop--category-title-reflects-current-filters) |
| Shop filter by color | `/shop/?filter_color={slug}` | Archive | `archive-product.php` | devvn + WC | CĂ³ | KhĂ´ng | |
| Shop filter by gender | `/shop/?filter_gender=nam\|nu` | Archive | `archive-product.php` | Custom filter | CĂ³ | KhĂ´ng | |
| Shop filter by price range | `/shop/?min_price=X&max_price=Y` | Archive | `archive-product.php` | devvn-woocommerce-price-filter | CĂ³ | KhĂ´ng | |
| Pagination | `/shop/page/N/` hoáº·c `?paged=N` | Archive | `archive-product.php` | WP_Query | CĂ³ | KhĂ´ng | `rel=next/prev` Ä‘Ă£ bá»‹ disable (xem [BUSINESS_RULES.md#br-17](BUSINESS_RULES.md#br-17--rel-next--rel-prev-disabled-on-listing-pages)) |

---

## 6. Special landing pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| Slider (CPT) | UNKNOWN â€” 2 items CPT `slider`, chá»‰ Ä‘Æ°á»£c tiĂªu thá»¥ bá»Ÿi home page | n/a | KhĂ´ng template single rĂµ rĂ ng | ACF fields | KhĂ´ng | NEEDS_CONFIRMATION | Chá»‰ lĂ m nguá»“n data cho home carousel |

---

## 7. Auth-protected / account pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| My Account Dashboard | `/tai-khoan/` (WC tab máº·c Ä‘á»‹nh) | Dynamic | [my-account.php](files/wp-content/themes/bigbike/woocommerce/myaccount/my-account.php) â†’ [dashboard.php](files/wp-content/themes/bigbike/woocommerce/myaccount/dashboard.php) | Current user | Noindex | KhĂ´ng | |
| My Orders | `/tai-khoan/orders/` | Dynamic | `woocommerce/myaccount/orders.php` + `my-orders.php` | Orders HPOS | Noindex | KhĂ´ng | |
| View order | `/tai-khoan/view-order/{id}/` | Dynamic | `woocommerce/myaccount/view-order.php` + `order/order-details.php` + `order-details-customer.php` | Order | Noindex | KhĂ´ng | |
| Edit account | `/tai-khoan/edit-account/` | Dynamic | `woocommerce/myaccount/form-edit-account.php` | Current user | Noindex | KhĂ´ng | |
| Edit address | `/tai-khoan/edit-address/{billing\|shipping}/` | Dynamic | `woocommerce/myaccount/form-edit-address.php` + `my-address.php` | User meta | Noindex | KhĂ´ng | |
| Downloads | `/tai-khoan/downloads/` | Dynamic | `woocommerce/myaccount/downloads.php` + `my-downloads.php` | (náº¿u cĂ³ sáº£n pháº©m downloadable â€” NEEDS_CONFIRMATION) | Noindex | KhĂ´ng | KhĂ´ng cháº¯c cĂ³ dĂ¹ng |
| Payment methods | `/tai-khoan/payment-methods/` | Dynamic | `woocommerce/myaccount/payment-methods.php` | Payment tokens | Noindex | KhĂ´ng | Vá»›i BACS+COD, feature nĂ y NEEDS_CONFIRMATION |
| Reset password | `/my-account/lost-password/?action=rp&key=...` | Dynamic | `woocommerce/myaccount/form-reset-password.php` + `form-lost-password.php` | â€” | Noindex | KhĂ´ng | Custom redirect sau reset |

---

## 8. 404 / error pages

| Page Name | Old URL | Type | Template | Data | SEO | Admin | Notes |
|---|---|---|---|---|---|---|---|
| 404 | (any unknown) | Error | [404.php](files/wp-content/themes/bigbike/404.php) | â€” | Noindex | KhĂ´ng | Ná»™i dung NEEDS_CONFIRMATION |

---

## 9. Admin-only pages (khĂ´ng render cĂ´ng khai)

| Page | Notes |
|---|---|
| `/wp-admin/` | Trang admin máº·c Ä‘á»‹nh WordPress; sáº½ thay tháº¿ báº±ng admin-fe sau migration |
| `/wp-login.php` | Login admin; giá»¯ táº¡m, áº©n trĂªn public DNS sau khi admin-fe live |

---

## 10. Menu cáº¥u trĂºc (`nav_menu_item` count=46)

Theme Ä‘Äƒng kĂ½ 3 menu location ([functions.php:42-46](files/wp-content/themes/bigbike/functions.php#L42-L46)):
- `primary` â€” Header menu
- `footer` â€” Footer menu
- `guide` â€” Menu secondary cho trang hÆ°á»›ng dáº«n

Ná»™i dung menu thá»±c táº¿ NEEDS_CONFIRMATION â€” cáº§n query `kd_term_taxonomy` where taxonomy='nav_menu' vĂ  join `kd_term_relationships` + `kd_postmeta` (_menu_item_*).

---

## 11. Danh sĂ¡ch chÆ°a verify hoĂ n toĂ n

- URL `/shop/` â€” shop_page_id=1 nhÆ°ng chÆ°a verify slug. CĂ³ thá»ƒ lĂ  `/shop` hoáº·c URL Viá»‡t hĂ³a.
- URL cĂ¡c page chĂ­nh sĂ¡ch: `/chinh-sach-bao-mat/`, `/chinh-sach-doi-tra/`, `/chinh-sach-giao-hang/`, `/dieu-khoan/` (suy Ä‘oĂ¡n). NEEDS_CONFIRMATION.
- `/video/{slug}` â€” cáº§n kiá»ƒm tra permalink rule cho CPT `video`.
- `/review/{slug}` â€” tÆ°Æ¡ng tá»±.
- `/hdsd/` hoáº·c sub-path cá»§a `/huong-dan/` â€” NEEDS_CONFIRMATION.
- Táº¥t cáº£ 80 page trong DB cáº§n Ä‘Æ°á»£c liá»‡t kĂª Ä‘áº§y Ä‘á»§. Lá»‡nh truy xuáº¥t: `SELECT ID, post_name, post_title, post_status, post_parent FROM kd_posts WHERE post_type='page' ORDER BY post_name`.

---

## 12. Summary counts

| Loáº¡i | Sá»‘ lÆ°á»£ng (verified tá»« dump) | Æ¯u tiĂªn migrate |
|---|---|---|
| Product | **1,227** | Cao |
| Product variation | 4,040 | Cao |
| Blog post | **174** | Trung |
| Page | **22** | Cao |
| Video (CPT, Pods-generated) | **62** | Tháº¥p (khĂ¡ch hĂ ng xĂ¡c Ä‘á»‹nh) |
| Review (CPT) | **0** â€” khĂ´ng pháº£i CPT riĂªng. Náº¿u ná»™i dung review náº±m trong blog category â†’ gá»™p chung vá»›i blog post | â€” |
| Slider (CPT) | 2 | Trung (lĂ m source cho home) |
| Shop order (legacy HPOS táº¯t) | **825** | Cao |
| Shop coupon | 1 | Tháº¥p |
| Contact form CF7 | 1 (id 8895) | Cao (recreate form shape: your_name/email/phone/message) |
| Menu items | 46 | Trung (recreate) |
| Attachment | 12,053 | Cao (media migration) |
| Users | 3,997 (verified) | Cao |


