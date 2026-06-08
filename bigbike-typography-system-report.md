# Báo cáo Audit Hệ thống Typography — Dự án WordPress "bigbike"

> **Ngày audit:** 2026-06-07
> **Phạm vi:** toàn bộ theme `bigbike`, CSS plugin, CSS inline trong PHP, Custom CSS trong database (`sqldump.sql`), critical CSS (Autoptimize).
> **WordPress root thực:** `/var/www/bigbike/files/` (thư mục làm việc `/root/myproject/bigbike/` chỉ chứa scripts/docs/dump, không phải WP root).
> **Phương pháp:** 6 agent trích xuất song song (đã hoàn tất) + trích xuất trực tiếp bằng `grep`/`awk`/Python cho các nguồn còn lại sau khi workflow chạm giới hạn quota tuần. Mọi phát hiện đều trích dẫn đường dẫn file. Phát hiện không chắc chắn đánh dấu **"Needs verification"**.

---

## 0. TÓM TẮT ĐIỀU HÀNH (đọc trước)

Hệ typography của bigbike là di sản của theme khởi tạo **Underscores (`_s`)** đã bị tùy biến chồng nhiều lớp, qua nhiều năm và nhiều người. Năm vấn đề nghiêm trọng nhất:

1. **Font Oswald được dùng ~137–191 lần nhưng KHÔNG được nạp ở bất kỳ đâu** → toàn bộ heading, tên/giá sản phẩm đang render bằng `sans-serif` hệ thống chứ không phải Oswald. (`styles/fonts.css` bị comment 100%; `footer.php` không nạp Oswald.)
2. **`styles/fonts.css` (≈434 KB) bị comment toàn bộ** (dòng 1–53 nằm trong 1 cặp `/* */`) nhưng vẫn được `wp_enqueue_style` trên nhiều trang → tải vô ích, không nạp font nào. Font thật được nạp inline ở **`footer.php`** (Barlow + Barlow Condensed base64 + icomoon).
3. **`html{font-size:14px}` → 1rem = 14px**, nhưng `body` cuối cùng lại là `16px`; toàn bộ thang rem lẻ (1.143rem, 3.429rem, 4.286rem…) được quy đổi theo gốc 14px. Hệ kích thước rối, trộn px/rem/em/% không có hệ thống.
4. **7 biến CSS `:root` (`--theme-size`, `--theme-font`, `--theme-font-second`, `--theme-red`…) khai báo nhưng KHÔNG dùng** (`var(--…)` = 0 lần) — mọi giá trị bị hardcode lặp lại.
5. **Trùng lặp & mâu thuẫn quy mô lớn**: cùng một component (vd `.product--item-title`) mang font khác nhau tùy trang (Oswald ở trang này, Barlow Condensed ở trang khác); `styles/` và `dist/` nhân đôi nhau; "Font Awesome 5 Pro" được tham chiếu 115 lần nhưng không nạp (chỉ icomoon vá một phần `.fa-*`).

**Không có typography responsive thực sự**: 0 `clamp()`, 0 `font-size` theo `vw`, 0 `calc()` cho chữ. Tất cả ~120 `@media` đều là grid/layout; chỉ một nhúm nhỏ trong `custom.css` đổi font-size theo breakpoint.

---

## 1. TỔNG QUAN DỰ ÁN

### 1.1 Theme & cấu trúc

| Hạng mục | Giá trị | Nguồn |
|---|---|---|
| Theme chính | **bigbike** v1.0.0 | `/var/www/bigbike/files/wp-content/themes/bigbike/style.css` (header) |
| Nền tảng gốc | Underscores (`_s`) — "king is based on Underscores" | `style.css` dòng 17 |
| Child theme | **Không có** | chỉ 1 theme + `index.php` trong `wp-content/themes/` |
| `theme.json` / block theme | **Không có** (classic theme) | `find … -name theme.json` = rỗng |
| Trình soạn thảo | Classic — `classic-editor` + `classic-widgets` đang bật | `wp-content/plugins/` |
| Build pipeline | Gulp (`gulpfile.js`, `package.json`) → sinh `dist/*.css(.min)` | `themes/bigbike/gulpfile.js` |
| Môi trường | `define('ENVIROMENT', "production")` → trang home/product/general nạp **bundle `dist/*.min.css`** | `/var/www/bigbike/files/wp-config.php:47` |

### 1.2 Số lượng file & rule

| Nhóm | Số file CSS/SCSS/LESS | Ghi chú |
|---|---|---|
| Theme `bigbike` (gồm cả `.min`/vendor) | 33 | 16 file `styles/`, 8 bundle `dist/`, 6 vendor `plugin/`, `style.css`, `rtl.css`, 2 `layouts/` |
| Plugins (tổng) | 776 | Phần lớn **admin** hoặc **woo-blocks không nạp** (xem §1.3) |
| `uploads/` (CSS tùy biến) | 0 | `uploads/ao_ccss/` chỉ có `index.html` — **không có critical CSS** |

**Số khai báo typography (declaration) bắt được — theo nguồn canonical (tránh đếm trùng `dist` vs `styles`):**

| Nguồn | Declaration | Nguồn dữ liệu |
|---|---|---|
| `styles/main.css` | 147 | fragment main-css |
| `styles/home.css` + `product.css` + `product-detail.css` + `custom.css` | 724 | fragment styles-pages-1 |
| `styles/news.css` + `news-detail` + `cart` + `check-out` + `login` + `register` + `static-page` + `payment-success` | 856 | fragment styles-pages-2 |
| Vendor (`swiper`/`select2`/`fancybox`/`sweetalert2`/`toastr`) | 166 (193 nếu tính bản `.scss` trùng) | fragment theme-vendor |
| `@font-face` footer.php (active) + Bitrix24 inline | 58 + 27 | fragment fonts-inventory |
| `styles/fonts.css` (toàn bộ trong comment) | 30 | fragment fonts-inventory |
| `style.css` gốc `_s` (**không được enqueue**) | 60 | fragment theme-core |
| Custom CSS DB (post 29751) | ~15 | trích trực tiếp từ `sqldump.sql` |
| Inline `<style>` `single.php` (TOC) + `header.php` | ~10 | trích trực tiếp |
| Rule chèn tay riêng trong `dist/*` (không có trong `styles/`) | ~12 | trích trực tiếp |
| **Tổng canonical (không tính `dist` nhân bản)** | **≈ 2.080** | |
| (Đếm thô mọi property typography trong CSS theme non-min, **gồm cả `dist` trùng lặp**) | **2.881** | `grep` trực tiếp |

### 1.3 Plugin tác động typography front-end

| Plugin | Ảnh hưởng front-end | Chi tiết |
|---|---|---|
| **WooCommerce** | **Gần như KHÔNG** — CSS bị theme dequeue | `inc/layout-functions.php:152-155` dequeue **vô điều kiện** `woocommerce-layout`, `woocommerce-general`, `woocommerce-smallscreen`, `wc-block-style` (điều kiện `if(!is_woocommerce()…)` đã bị comment). Theme tự tạo toàn bộ style Woo. CSS gốc Woo dùng `em` (.857em/.83em/.75em…) nhưng không áp dụng. |
| **contact-form-7** | Tối thiểu | `includes/css/styles.css`: chỉ `font-size:1em` (kế thừa). Chỉ nạp trên trang template `page-contact.php` (các trang khác bị `wp_deregister_style('contact-form-7')` — `layout-functions.php:134-137`). |
| **perfect-woocommerce-brands**, **woo-product-variation-gallery**, **polylang** | Nhỏ | Chủ yếu CSS slider (slick) / dialog / backend; không định nghĩa thang chữ. |
| **seo-by-rank-math**, **wordfence**, **w3-total-cache**, **autoptimize**, **pods**, **acf-pro**, **tinymce-advanced**, … (18 plugin) | **Admin-only** | CSS typography chỉ trong trang quản trị (`admin_enqueue_scripts`). Wordfence có FontAwesome 4 nhưng chỉ trang login/admin của Wordfence. |
| **WooCommerce Blocks** (~300 file CSS) | **KHÔNG nạp** | Site dùng classic-editor; `wc-block-style` bị dequeue. *Needs verification* nếu có shortcode block trong nội dung. |
| **Autoptimize** | CSS optimize **tắt** | Option `autoptimize_css = ''` (rỗng) trong DB dù `aggregate`/`inline` = `on`; thư mục `ao_ccss` rỗng → CSS được serve nguyên trạng theo enqueue (W3TC vẫn cache page). |

---

## 2. TYPOGRAPHY SCALE (Thang kích thước chữ)

### 2.1 Nền móng — gốc rem

| Selector | Giá trị | Nguồn | Ghi chú |
|---|---|---|---|
| `html` | **14px** | `styles/main.css` (offset ~73.377), `dist/*` | **1rem = 14px** — gốc của mọi giá trị rem |
| `body` (rule cuối, thắng cascade) | **16px** + `font-family:Barlow` (không fallback) | `styles/main.css` (offset 89.986) | body ≠ 1rem |
| `body` (rule giữa, bị đè) | `1rem` (=14px) + `Barlow,sans-serif` | `styles/main.css` (offset 73.397) | |
| `body` (Bootstrap Reboot, bị đè) | system stack, `font-weight:400`, `line-height:1.5` | `styles/main.css` (offset 601), `dist/*` | |

> **Quy đổi:** vì 1rem = 14px, các giá trị rem "lẻ" thực ra là px tròn: `1.143rem`=16px · `1.214rem`=17px · `1.286rem`=18px · `1.357rem`=19px · `1.429rem`=20px · `1.5rem`=21px · `1.714rem`=24px · `2.071rem`=29px · `2.143rem`=30px · `3.571rem`=50px · `3.75rem`=52.5px · `4.286rem`=60px · `4.375rem`=61.25px. **Nhưng** một nhóm giá trị khác (`.625rem`,`.875rem`,`1.25rem`,`3.125rem`) lại được tính theo gốc 16px (=10/14/20/50px) → **trộn hai hệ gốc rem trong cùng codebase**.

### 2.2 Bảng tổng hợp font-size theo loại phần tử

> Cột "≈px" quy đổi theo `html=14px`. "(I)" = giá trị không hợp lệ (thiếu đơn vị).

| Loại phần tử | Selector tiêu biểu | Font size | Đơn vị (≈px) | File nguồn |
|---|---|---|---|---|
| **Body / văn bản** | `body` | 16px | px | `styles/main.css` |
| Văn bản phụ | `.block-text p` | .875rem | rem (12.25px) | `styles/main.css` |
| Đoạn nội dung wyswyg | `body .block-text p, body .wyswyg` | 16px | px | `styles/custom.css` |
| Đoạn nội dung | `.wyswyg` | .875rem / 14px | rem/px (lệch) | `news-detail.css` / `static-page.css` |
| **H1 trang** | `.page-title h1` | 4.375rem | rem (61.25px) | `product.css`, `product-detail.css`, `custom.css` |
| H1 trang (đè) | `body .page-title h1` | 24px | px | `styles/custom.css` |
| H1 sản phẩm | `.product-information .title h1` | 30px | px | `product-detail.css` |
| H1 bài viết | `.blog-title h1` | 1.714rem | rem (24px) | `news-detail.css` |
| **Tiêu đề khối H3** | `.block-title h3` | 3.571rem | rem (50px) | `product.css`, `product-detail.css` |
| Tiêu đề khối H3 (đè) | `body .block-title h3, .related_heading` | 35px | px | `custom.css`, `dist/*` (chèn tay) |
| Tiêu đề khối (mobile) | `body .block-title h3` `@media(max-width:767px)` | 24px | px | `styles/custom.css` |
| Sub-title khối | `.block-title p.sub-title` | 1.143rem | rem (16px) | nhiều file |
| Widget title | `.widget--title h3` | 1.5rem | rem (21px) | nhiều file |
| Widget title lớn | `.widget--title h3.big` | 2.143rem / **20px!important** | rem/px (mâu thuẫn) | `product.css` / `custom.css` |
| **Tên sản phẩm** | `.product .product--item-title` | 1rem | rem (14px) | nhiều file |
| **Giá sản phẩm** | `.product--item-price` (+`p`) | 1rem → **14px** (đè) | rem/px | base / `body .product--item-price` (custom.css) |
| Nhãn "Sale" | `.product .product--item-sale p` | 18px | px | `styles/custom.css` |
| Danh mục sản phẩm | `.product--item-category` | (kế thừa) + weight 600 | — | nhiều file |
| **Menu / điều hướng** | `header .navigation` | 1.143rem | rem (16px) | `styles/main.css` |
| Submenu | `header … .sub-menu li a` | 14px | px | `styles/custom.css` |
| User control | `header .user-control--item>a` | 1.286rem | rem (18px) | `styles/main.css` |
| Search input (desktop) | `header …search form input` `@media(min-width:768px)` | 24px | px | `styles/custom.css` |
| **Nút (button)** | `.btn` | (kế thừa) + Barlow Condensed | — | `styles/main.css` |
| Nút submit | `.form-submit button` | 14px | px | nhiều file |
| Nút quick-buy | `.quickbuy-box …button[type=submit]` | 16px | px | `product-detail.css`, `dist/product-page.css` |
| **Form** | `.form-group label, .form-control` | 14px | px | mọi trang |
| Form select | `.form-group select` | .875rem | rem (12.25px) | nhiều file |
| Mũi tên select | `.form-group.form-select:after` | .625rem | rem (8.75px) | nhiều file |
| **Pagination** | `.pagination ul li (a)` | 1.5rem | rem (21px) | nhiều file |
| **Breadcrumb** | `body .breadcrumb ul li a` | (kế thừa, weight 600) | — | `custom.css` |
| **Tin tức** | `.news--item-inside h3` | 1.25rem | rem (17.5px) | `home.css`, `news.css` |
| Ngày tin | `.news--item-desc .news-date` | 12px | px | `custom.css` |
| **Slogan (custom CSS)** | `.slogan-bigbike` | 3.429rem | rem (48px) | DB post 29751 |
| **Newsletter H3** | `.newletters form h3` | 3.429rem | rem (48px) | `styles/main.css` |
| **Giỏ hàng — tổng tiền** | `.summary.total-summary .total-price` | 1.714rem | rem (24px) | `cart.css`, `check-out.css` |
| Số lượng (input/nút) | `.cart-table …quantity button/input` | 1.714rem / 1.429rem | rem (24/20px) | `cart.css`, `check-out.css` |
| **Đăng nhập/ký — tab** | `.user-activity .user-activity-tab ul li a` | 24px | px | `login.css`, `register.css` |
| **Thanh toán thành công** | `.payment-success .desc h3` | 1.714rem | rem (24px) | `payment-success.css` |
| **Footer** | `footer .foot .col-md-4` `@media(max-width:767px)` | 14px | px | `custom.css` |
| Footer toggle title | `footer …toggle--item-title` (inline) | 1.143rem | rem (16px) | `footer.php` (inline `style=`) |
| **Mũi tên slider** | `.swiper-button-next/prev` | 3.125rem | rem (43.75px) | nhiều file |
| Icon video play | `.videos-slide--inner-item-thumbnail i` | 1.875rem | rem (26.25px) | `home.css` |
| **TOC (single)** | `.toc-title` | 1.2rem | rem (16.8px) | `single.php` (inline) |
| **Vendor — SweetAlert2** | `.swal2-popup` | 1rem; con dùng `em` (1.125/1.875/2.5em…) | rem/em | `sweetalert2.min.css` |
| Vendor — fancybox | `.fancybox-share h1` | 35px | px | `jquery.fancybox.min.css` |
| Vendor — select2 | `__rendered` line + size | 1em / 100% | em/% | `select2.min.css` |

### 2.3 Tập hợp TẤT CẢ font-size distinct (toàn dự án)

**rem (gốc 14px):** `.625rem` (8.75) · `.875rem` (12.25) · `1rem` (14) · `1.1rem` (15.4) · `1.125rem` · `1.143rem` (16) · `1.175rem` (16.45) · `1.2rem` (16.8) · `1.25rem` (17.5) · `1.286rem` (18) · `1.429rem` (20) · `1.5rem` (21) · `1.714rem` (24) · `1.875rem` (26.25) · `2.143rem` (30) · `3.125rem` (43.75) · `3.429rem` (48) · `3.571rem` (50) · `4.375rem` (61.25)

**px:** `12px` · `13px` · `14px` · `16px` · `18px` · `20px` (+`20px!important`) · `22px` · `24px` · `30px` · `35px` · `40px` · `50px`

**em (vendor, scale theo cha):** `.8em` · `1em` · `1.0625em` · `1.125em` · `1.4em` · `1.5em` · `1.875em` · `2em` · `2.5em` · `3.75em` · `1.1em`

**% & khác:** `75%` · `80%` · `100%` · `125%` · `var(--swiper-navigation-size)` (=44px) · `0`

**Giá trị lỗi:** `font-size:1.714` (thiếu đơn vị) tại `.content-carousel--content-body h3` — `home.css` → trình duyệt bỏ qua.

> **Tổng cộng ≈ 45+ giá trị font-size khác nhau** cho một site — quá phân mảnh (xem §8, §9).

---

## 3. FONT FAMILIES & FALLBACKS

### 3.1 Font ĐƯỢC THAM CHIẾU vs ĐƯỢC NẠP (bảng quyết định)

| Font (tham chiếu trong CSS) | Số lần dùng | @font-face active? | Nguồn nạp | Kết quả thực tế |
|---|---|---|---|---|
| **`Oswald,sans-serif`** | ~137 (191 tính cả dist) | ❌ **KHÔNG** | (chỉ có trong `fonts.css` đã comment) | ⚠️ **Rơi về `sans-serif`** — heading/giá/menu phụ KHÔNG phải Oswald |
| **`Barlow` / `Barlow,sans-serif`** | ~113 | ✅ 400, 600 | `footer.php` (base64 woff) | OK cho 400/600; weight 300/500/700 → browser tự map |
| **`Barlow Condensed[,sans-serif]`** | ~124 | ✅ 300/400/500/600 | `footer.php` (base64 woff2) | OK (weight 300 nạp nhưng không rule nào dùng → dư) |
| **`Font Awesome 5 Pro`** (3 cách viết) | 115 | ❌ **KHÔNG** | (không @font-face, không CDN, không kit) | ⚠️ Icon `:before/:after` **vỡ**, trừ `.fa-*` được icomoon đè |
| `icomoon` | (footer) | ✅ normal (file) | `footer.php` → `fonts/icomoon.*` | OK — engine thật cho mọi class `.fa-*` |
| `swiper-icons` | 8 | ✅ 400 (base64) | `swiper.min.css`, `dist/home`, `dist/product-page` | OK (chỉ trang home/product) |

### 3.2 Cơ chế nạp font — KẾT LUẬN

- **`styles/fonts.css` bị comment 100%** (1 cặp `/* */` bao dòng 1–53; xác minh: chỉ 1 `/*` + 1 `*/` trong file) → **nạp 0 font** dù được `wp_enqueue_style` ở 4 vị trí (`inc/layout-functions.php:25,50,76,91`). Tải ~434KB vô ích.
- **Nguồn font thật = `footer.php`** inline `<style>` (dòng 130–260), nạp base64: **Barlow 400/600**, **Barlow Condensed 300/400/500/600**, **icomoon** (file). Đặt cuối `<body>`, **không preload** → nguy cơ FOUT/FOIT.
- `dist/*` chỉ thêm `@font-face swiper-icons` (home/product).
- **Không phụ thuộc Google Fonts / Adobe Fonts / CDN nào** (grep `fonts.googleapis|gstatic|typekit|fontawesome` toàn theme+plugin front-end = rỗng). 100% self-hosted.

### 3.3 Stack font đầy đủ (tất cả giá trị distinct)

| Font stack | Vai trò | Nơi dùng |
|---|---|---|
| `Barlow` (KHÔNG fallback) | body (rule thắng) | `styles/main.css` offset 89.986 |
| `Barlow,sans-serif` | body, about-us, nội dung | `main.css`, `custom.css`, `dist/*` |
| `"Barlow",sans-serif` | biến `--theme-font` (**không dùng**) | `:root` mọi file |
| `Barlow Condensed,sans-serif` | menu, nút, form, heading | `main.css`, page CSS |
| `Barlow Condensed` (KHÔNG fallback) | `.shipping-calculator-form button`, checkout headings | `custom.css`, `check-out.css`, `payment-success.css` |
| `"Barlow Condensed",sans-serif` | slogan, login/register tab | DB post 29751, `custom.css` |
| `Oswald,sans-serif` | heading, tên/giá SP (⚠️ không nạp) | `home.css`, `custom.css`, `news-detail.css`, `static-page.css`, `dist/*` |
| `Font Awesome\ 5 Pro` / `Font Awesome\5 Pro` / `Font awesome\5 Pro` | icon pseudo-element (⚠️ không nạp) | page CSS (3 cách viết khác nhau) |
| `icomoon` | `[class^="fa-"]`, `.form-select:after` | `footer.php` |
| `swiper-icons` | mũi tên swiper | `swiper.min.css`, `dist/*` |
| `helvetica,arial,verdana` (không generic cuối) | `.jq-rating-label` | `custom.css` |
| `-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans,sans-serif,…emoji` | body Reboot (bị đè) | `main.css`, `dist/*` |
| `SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace` | `code,kbd,pre,samp` | `main.css`, `dist/*` |
| `inherit` | reset button/input | nhiều file |
| `serif` | `.swal2-close` (ký tự ×) | `sweetalert2.min.css` |
| `Helvetica, Arial, sans-serif` | widget Bitrix24 | `footer.php` (inline) |
| `monospace,monospace` / `"Courier 10 Pitch",Courier,monospace` / `Monaco,Consolas,"Andale Mono",…` | normalize (style.css **không enqueue**) | `style.css` |

### 3.4 Font mồ côi (~11MB không được dùng)

Trong `themes/bigbike/fonts/` (54 file) chỉ **4 file icomoon** thực sự dùng. Mồ côi: `Barlow-Bold/Light/Regular`, `Oswald-Medium/SemiBold`, `iCielAvenirLTStd-35Light/55Roman/95Black` (0 tham chiếu "Avenir"), `fa-brands-400/fa-light-300/fa-regular-400/fa-solid-900` (Font Awesome 5 Pro). **Barlow Condensed không có file trên đĩa** — chỉ tồn tại base64 trong `footer.php` (khiến `footer.php` nặng ~678KB).

---

## 4. FONT WEIGHTS & STYLES

| Weight | Có @font-face nạp? | Selector tiêu biểu | Ghi chú |
|---|---|---|---|
| **300** | Barlow Condensed ✅ / Barlow ❌ (comment) | `.user-logged span` (custom.css) | Barlow 300 không nạp → faux/fallback |
| **400 / normal** | Barlow ✅, Barlow Condensed ✅ | body, swiper buttons, FA radio | OK |
| **500** | Barlow Condensed ✅ / Barlow ❌, Oswald ❌ | `.category-list .item--category`, `.forgot-password-link a`, `.slogan-bigbike` | Oswald 500 (font có file nhưng @font-face comment) → không nạp |
| **600** | Barlow ✅, Barlow Condensed ✅ / Oswald ❌ | rất nhiều: 41 rule Oswald-600, 27 rule Barlow Condensed-600, `b,h1..h6,strong` | Oswald-600 (heading/giá) → render faux-bold trên sans-serif |
| **600!important** | — | `.product .desc h2 span`, `.seo-block-content …h2/h3 span` | lạm dụng !important |
| **700** | ❌ (Barlow-Bold có file, không @font-face) | `dt`, `.widget--title h3.big`, `.quickbuy …button`, `.woocommerce-MyAccount-content a` | **faux bold** (browser tự làm đậm) |
| **bold** (keyword) | — | `.user-control--item.cart a .number-cart`, `.title-contact-me` (DB) | trộn keyword với số |

**Font-style:** chỉ **1 chỗ `italic`** trong toàn theme: `.shipping-method-description{font-style:italic}` (`custom.css` + chèn tay trong `dist/*`). `font-style:normal` xuất hiện ở các @font-face + `.fa-*`. **Không có** `oblique`, `font-variant` (trừ `normal` ở `.fa-*`), `font-stretch`, `font-feature-settings` (= 0 toàn dự án).

---

## 5. LINE HEIGHTS & LETTER SPACINGS

### 5.1 Letter-spacing / word-spacing

**`letter-spacing` = 0 lần. `word-spacing` = 0 lần** trên TOÀN BỘ dự án (theme + plugin front-end). Đã kiểm chứng từng nhóm file. → Hệ chữ hoàn toàn dùng giãn cách mặc định.

### 5.2 Line-height (tổng hợp)

| Loại | Selector | Giá trị | Đơn vị | File |
|---|---|---|---|---|
| Base html | `html` | 1.15 | unitless | main.css (Reboot) |
| Base body | `body` | 1.5 | unitless | main.css (Reboot) |
| Đoạn văn | `.block-title--content p` | 1.214 | **unitless (I)** — lẽ ra rem? | home/product/custom |
| Đoạn văn | `.product--item-price p` | 1.214rem | rem (17px) | nhiều file |
| Sub-title | `.block-title p.sub-title` | 1.357rem | rem (19px) | nhiều file |
| H3 khối | `.block-title h3` | 4.286rem | rem (60px) | nhiều file |
| H3 khối (mobile) | `body .block-title h3` | 30px | px | custom.css |
| H1 SP | `.product-information .title h1` | 3.75rem | rem (52.5px) | product-detail.css |
| H1 bài viết | `.blog-title h1` | 2.071rem | rem (29px) | news-detail.css |
| Newsletter H3 | `.newletters form h3` | 4.143rem | rem (58px) | main.css |
| Slogan (DB) | `.slogan-bigbike` | 4.143rem | rem (58px) | post 29751 |
| Nội dung wyswyg | `.wyswyg p, ul li` | 1.5625rem | rem (21.9px) | news-detail, static-page |
| Tin — title | `.news--item-inside h3` | 1.5rem | rem (21px) | home, news |
| **Magic-number (=height nút)** | `.btn` | 52px | px | main.css |
| | `.btn-submit` | 62px | px | main.css |
| | `.btn-continue-shopping` | 62px | px | cart.css |
| | `.quickbuy …button` | 45px | px | product-detail.css |
| | select2 `__rendered` | 28px / 50px | px | select2 / form |
| | `.product--item-sale p`, `.news-date p` | 42px | px | nhiều file |
| | `.user-activity-tab li a` | 42px | px | login/register |
| Reset cứng | `.product-information *` | 1 | unitless | product-detail.css |
| Vendor | `.swal2-icon` | 5em | em | sweetalert2 |
| Vendor | `.fancybox-caption` | 1.5 | unitless | fancybox |

**Vấn đề line-height:** (a) nhiều `line-height = chiều cao px của nút` (52/62/45/42/28px) — căn giữa 1 dòng, **gãy khi text xuống dòng**; (b) `.block-title--content p` `1.214` thiếu đơn vị (nhập nhằng so với `1.214rem`); (c) `.product-information *{line-height:1}` reset cứng toàn bộ con cháu; (d) trộn unitless/rem/px không hệ thống.

---

## 6. TEXT DECORATIONS, TRANSFORMS & COLORS

### 6.1 Text-transform

| Giá trị | Phạm vi | Tiêu biểu |
|---|---|---|
| `uppercase` | **Rất phổ biến** (menu, nút, sale, category, widget title, news date, slogan, login/register tab, about-us heading…) | `header .navigation--item>a`, `.product--item-cart a`, `.form-group select`, `.user-activity-tab li a`, `.slogan-bigbike` |
| `none` | reset | `button,select` (Reboot), `.user-logged span`, `.swal2-title`, `.fa-*` |
| `capitalize` | 1 chỗ | `body …mobile-item .user-logged a` `@media(max-width:1260px)` |

### 6.2 Text-decoration

| Giá trị | Selector | File |
|---|---|---|
| `none!important` (toàn cục link) | `a` (khối theme) | main.css — **chặn mọi underline link**, đè cả Reboot `a:hover` |
| `line-through` | `.product--item-price p.old` (giá cũ) | mọi trang SP |
| `underline` | `.toc-title` con, `.seo-block-content …p a`, `.user-activity-content-title a`, `.woocommerce-MyAccount-content a`, `abbr[title]` | nhiều |
| `underline!important` / `none!important` | `.forgot-password-link a` / `:hover` | product.css, page CSS (lặp 8+ file) |
| `none` | `.btn`, `.product-information .price p ins`, vendor caption | nhiều |

### 6.3 Text-shadow

Gần như **không dùng**: chỉ vendor `toastr` (`.toast-close-button{text-shadow:0 1px 0 #fff}` + bản phi chuẩn `-webkit-text-shadow`). Theme chính: 0.

### 6.4 Màu chữ (consolidated — toàn dự án)

**Màu thương hiệu & trung tính chính:**

| Mã màu | Vai trò | Số lần (ước tính toàn theme) | Ghi chú |
|---|---|---|---|
| `#fff` / `#ffffff` / `#FFF` | Chữ trên nền tối | ~120+ | 3 cách viết hoa/thường |
| `#000` / `#000000` | Chữ chính tối | ~50+ | = `--theme-black` (không dùng var) |
| `#ff0c09` | **Đỏ thương hiệu** | ~90+ | = `--theme-red` (không dùng var); hardcode khắp nơi |
| `#cecece` | Xám nhạt (placeholder, giá cũ, sub-title, breadcrumb) | ~120+ | |
| `#6f6f6f` | Xám danh mục | ~17 | = `--theme-gray` (không dùng var) |
| `#3a3a3a` | Xám đậm nội dung | ~14 | |
| `#212529` | Reboot/table | ~5 | |
| `red` (keyword) | hover/active | 4 (custom.css) | ⚠️ **khác** `#ff0c09` → 2 sắc đỏ trên cùng UI |

**Các sắc xám rải rác (thiếu hệ thống):** `#717171`, `#7e7e7e`, `#525252`, `#4b4b4b`, `#777`, `#999`, `#444`, `#333`, `#888`, `#555`, `#666`, `#595959`, `#545454`, `#5d5b5b`, `grey`/`white` (keyword). → **~20 sắc xám/đen khác nhau**.

**Màu trạng thái / ngữ nghĩa:** `#0c5460` & `#721c24` (Woo message/error), `#6100d1` (giảm giá tím — cart), `#50a14f`/`#e45649` (password strength good/bad), vendor sweetalert2 (`#f8bb86` warning, `#3fc3ee` info, `#87adbd` question, `#f27474`), `#0056b3`/`#007bff` (link Bootstrap chưa override — *Needs verification*).

**Link mặc định `_s` chưa tùy biến** (royalblue/purple/midnightblue) tồn tại trong `style.css` nhưng **file không được enqueue** → vô hại.

---

## 7. RESPONSIVE TYPOGRAPHY

### 7.1 Kết luận tổng

- **KHÔNG có fluid typography:** 0 `clamp()`, 0 `font-size` theo `vw`, 0 `calc()` cho chữ (toàn dự án). Mọi font-size cố định trên mọi viewport — kể cả `.page-title h1` 61px và `.newletters form h3` 48px trên mobile.
- Đại đa số `@media` là **grid/layout** (Bootstrap), không đụng typography.

### 7.2 Danh sách breakpoint (toàn theme)

| Breakpoint | Số khối | Có đổi typography? |
|---|---|---|
| `@media (min-width:768px)` | 58 | Có (ít — search header) |
| `@media (max-width:767px)` | 50 | Có (ít — `custom.css`) |
| `@media (min-width:1200px)` | 35 | Không (grid) |
| `@media (min-width:992px)` | 30 | Không (grid) |
| `@media (min-width:576px)` | 30 | Không (grid) |
| `@media (min-width:1261px)` | 8 | Không |
| `@media (max-width:500px)` | 8 | Không |
| `@media print` | 5 | Không (chỉ `.d-print-*`) |
| `@media (max-width:992px)` / `(min-width:993px)` | 4+4 | Không |
| `@media (max-width:1260px)` | 4 | **Có** (mobile menu — `custom.css`) |
| `@media (max-width:1440px) and (min-width:768px)` | 4 | Không |
| `@media all and (-ms-high-contrast…)` | 2 | Không (IE hack, vendor) |
| `@media all (240/241-480/481-768px)` | 6 | Không (toastr) |
| `@media (max-height:576px)` | 1 | Có (màu icon fancybox) |

### 7.3 Các thay đổi typography theo breakpoint (đầy đủ)

**`@media (min-width:768px)`** (`custom.css`):
- `header …search .icon-close i, .icon-search i` → `font-size:18px; color:#fff`
- `header …search form input` → `font-size:24px; color:#fff; font-weight:400`
- `header …search.active form input::placeholder` → `color:#fff; font-weight:400`
- `header …user .toogle-menu li.login-btn a, li.register-btn a` → `line-height:50px; color:#fff; font-family:"Barlow Condensed",sans-serif; text-transform:uppercase; text-align:center`

**`@media (max-width:1260px)`** (`custom.css`, mobile menu):
- `.not-login .wrap a` → `font-size:16px; color:#fff` · `.not-login i` → `font-size:40px` · `.contact-me ul li .icon` → `font-size:24px; color:#ff0c09` · `.contact-me ul li p` → `font-family:Barlow,sans-serif; font-weight:400` · `.user-logged a` → `font-size:14px; font-weight:400; text-transform:capitalize; color:#4b4b4b` · `.user-logged p,span` → `font-size:16px; font-weight:600; text-transform:uppercase` · `.user-logged .logout-btn a` → `font-size:24px; color:#fff` · `.contact-me h3,.instagram h3` → `text-transform:uppercase` · `header .navigation ul .navigation--item` → `text-align:left`

**`@media (max-width:767px)`** (`custom.css`):
- `body .block-title h3` → `font-size:24px; line-height:30px` (desktop 35px/60px) — **đổi font-size theo breakpoint duy nhất đáng kể**
- `body .content-carousel--content-body h3` → `font-size:24px`
- `body .product .product--item-price` → `text-align:left` (desktop: right)
- `.gallery-top .swiper-button:after` → `font-size:18px; color:#000`
- `.product-list-filter …filter-mobile p, .form-select select` → `font-size:12px`
- `footer .foot .col-md-4` → `font-size:14px` · `footer .foot .col-md-6 p` → `color:#7e7e7e; line-height:20px`

**`@media (max-width:767px)`** (`footer.php` inline): `.page-title .row{min-height:250px}` (không phải typography).

**`@media (max-height:576px)`** (`fancybox`): `.fancybox-close-small{color:#f2f4f6}`.

> **Lưu ý quan trọng:** `home.css` và `product-detail.css` cũng có `@media(max-width:767px)` nhưng **chỉ chứa layout** (display/height/margin), không đổi typography. Toàn bộ typography responsive thực chất nằm trong `custom.css`.

---

## 8. INCONSISTENCIES & HARDCODED VALUES

> Đánh số để tham chiếu trong §9.

**A. Lỗi nạp font (nghiêm trọng)**
1. **Oswald không bao giờ nạp** dù dùng ~137–191 lần → heading/giá/menu phụ render bằng `sans-serif`. File `Oswald-Medium/SemiBold` có sẵn nhưng @font-face bị comment. (`styles/fonts.css`, đối chiếu `footer.php`)
2. **`styles/fonts.css` comment 100%** nhưng enqueue 4 lần → ~434KB vô ích mỗi lần tải. (`inc/layout-functions.php:25,50,76,91`)
3. **"Font Awesome 5 Pro" tham chiếu 115 lần, 0 @font-face** → icon `:before/:after` vỡ; chỉ `.form-group.form-select:after` được vá bằng icomoon. Checkbox/radio/select2-arrow/check-color **chưa vá**. (*Needs verification* render thực tế trong trình duyệt)
4. **3 cách viết family FontAwesome khác nhau**: `Font Awesome\ 5 Pro` (escape space), `Font Awesome\5 Pro` & `Font awesome\5 Pro` (escape hex `\5 ` → U+0005, chữ "a" thường). Không nhất quán; dạng `\5 ` parse sai tên.
5. **Khối comment `fonts.css` trỏ file không tồn tại** (`Barlow-Medium`, `Barlow-SemiBold`) — nếu un-comment sẽ 404.
6. **~11MB font mồ côi** (Avenir ×3, FA5 Pro ×4, Barlow-Bold, Oswald ×2…).
7. **faux-bold 700** khắp nơi (không có @font-face Barlow-700 dù có file).

**B. Hệ kích thước & đơn vị**
8. **3 rule `body` xung đột** → body=16px nhưng `html`=14px → `1rem ≠ body`. (`main.css`)
9. **Trộn 2 gốc rem**: nhóm tính theo 14px (1.143/1.214/3.571/4.286rem) vs nhóm theo 16px (.625/.875/1.25/3.125rem) trong cùng codebase.
10. **Trộn px/rem/em/% tùy tiện** trên cùng element (vd `.product-information .title h1{font-size:30px; line-height:3.75rem}`).
11. **`font-size:1.714` thiếu đơn vị** (invalid) — `.content-carousel--content-body h3` (`home.css`).
12. **line-height = chiều cao px nút** (52/62/45/42/28px) → gãy khi xuống dòng.
13. **~45 giá trị font-size khác nhau** — thang chữ quá phân mảnh.

**C. Biến CSS & hardcode**
14. **7 biến `:root` chết** (`--theme-size/font/font-second/red/black/white/gray`): `var(--…)` = 0 lần. Giá trị bị hardcode (#ff0c09 ×90+, Barlow/Barlow Condensed, #6f6f6f…).
15. **`--theme-size:14px` mâu thuẫn** body thực 16px.

**D. Mâu thuẫn & trùng lặp**
16. **Cùng component, font khác nhau theo trang**: `.product--item-title/-price`, `.block-title h3`, `.product-filter` dùng **Oswald** ở `home.css`/`news-detail.css`/`static-page.css` nhưng **Barlow Condensed** ở `product.css`/`product-detail.css`/`news.css`/`login.css`/`register.css`. `custom.css` lại override về Oswald bằng `body …` (tăng specificity). → Font hiển thị phụ thuộc thứ tự enqueue.
17. **`styles/` và `dist/` nhân đôi nhau** (production nạp `dist`, dev/category nạp `styles`); `dist/general-page.css` ≡ `dist/product-category.css` (md5 trùng `f48a670e…`).
18. **`custom.css` ~ copy của `product.css`** + `.wyswyg table{color:#212529}` lặp 2 lần liên tiếp.
19. **8 file page CSS lặp khối** `.form-group/.widget/.pagination/.product/.block-title` → sửa 1 chỗ phải đồng bộ 5–8 file (và đã lệch thực tế).
20. **cart.css vs check-out.css lệch font** heading (`Barlow Condensed` chỉ có ở check-out).
21. **`.wyswyg` lệch**: `.875rem` (news-detail) vs `14px` (static-page).
22. **Rule chèn tay vào `dist` sau build** (`.note-buy-product` 18px, `.related_heading` 35px Oswald, `.quickbuy…` 14/16px, `.shipping-method-description` 12px italic, `.tmp-width-height`) — rebuild Gulp sẽ **xóa mất**. `@media` viết cả `(max-width:767px)` lẫn `(max-width: 767px)` (có space) = dấu vết vá tay.

**E. Màu sắc**
23. **2 sắc đỏ** (`#ff0c09` vs keyword `red`) trên cùng UI.
24. **~20 sắc xám/đen** rời rạc; **3 cách viết** trắng (`#fff/#ffffff/#FFF`); trộn keyword (`grey/white/red`) với hex.

**F. Khác**
25. **`a{text-decoration:none!important}`** toàn cục chặn mọi underline.
26. **Lạm dụng `!important`** cho typography: `font-size:20px!important`, `font-weight:600!important` ×3, `line-height:52px!important`, `color:#fff!important`, `underline!important`.
27. **Thiếu fallback**: `font-family:Barlow Condensed` (không `sans-serif`) ở nhiều nơi; `.jq-rating-label` dùng `helvetica,arial,verdana` (không generic).
28. **`@font-face` đặt cuối `<body>`** (footer.php), không preload → FOUT; icon icomoon `font-display:block` → FOIT.
29. **`style.css` gốc `_s` không enqueue** (`functions.php:114` comment) → các rule normalize/heading trong đó vô hiệu; heading h1–h6 **không có font-size** trong CSS active → dùng cỡ mặc định trình duyệt (tính theo body 16px).
30. **`rtl.css` vô hiệu** (toàn bộ trong comment) — site không hỗ trợ RTL dù có file.

---

## 9. KHUYẾN NGHỊ CẢI THIỆN

> Theo CLAUDE.md, code mới đặt trong `theme inc/` hoặc `scripts/`, không inline vào `functions.php`. Các thay đổi CSS nên qua nguồn Gulp (`styles/` → `dist/`), **không** sửa trực tiếp `dist/`.

### 9.1 Khẩn cấp (sửa lỗi đang ảnh hưởng hiển thị)

1. **Quyết định số phận Oswald** (vấn đề #1):
   - *Nếu muốn dùng Oswald*: bỏ comment + sửa @font-face trong `styles/fonts.css` **và** chuyển vào `footer.php`/head (cùng chỗ Barlow) với `font-display:swap` + `<link rel="preload">`. Cần thêm weight 600 dạng file (hiện 600 chỉ có base64 comment).
   - *Nếu KHÔNG dùng*: thay toàn bộ `Oswald,sans-serif` → `"Barlow Condensed",sans-serif` (font đang nạp sẵn, cùng phong cách condensed) để loại faux-render. Đây là lựa chọn **rẻ và an toàn hơn**.
2. **Sửa icon "Font Awesome 5 Pro"** (#3,#4): thống nhất 1 cách viết, và hoặc (a) nạp đúng webfont FA5 Pro từ `fonts/` bằng @font-face, hoặc (b) map hết các glyph còn lại sang icomoon như đã làm với `.fa-*`. Kiểm tra trực tiếp các form checkbox/radio/select trên trình duyệt.
3. **Dọn `styles/fonts.css`** (#2): xóa khỏi enqueue (hoặc thay bằng file @font-face gọn, không base64) — tiết kiệm ~434KB/lượt.
4. **Sửa `font-size:1.714`** → `1.714rem` (#11).

### 9.2 Chuẩn hóa nền móng

5. **Chốt gốc rem**: giữ `html{font-size:14px}` (đã là chuẩn ngầm) và **xóa `body{font-size:16px}`** thừa, hoặc đổi `html` về 16px rồi quy đổi lại — nhưng **chỉ chọn MỘT hệ**. Hiện trạng 1rem≠body gây lỗi tính toán (#8,#9).
6. **Kích hoạt & dùng biến `:root`** (#14): thay hardcode `#ff0c09`→`var(--theme-red)`, `Oswald/Barlow…`→`var(--theme-font*)`. Hoặc xóa hẳn biến chết nếu không dùng.
7. **Định nghĩa thang chữ token** (thay ~45 giá trị rời): ví dụ `--fs-xs:.857rem; --fs-sm:1rem; --fs-base:1.143rem; --fs-lg:1.5rem; --fs-xl:2.143rem; --fs-2xl:3.571rem; --fs-3xl:4.375rem` (theo gốc 14px) và refactor dần.

### 9.3 Responsive

8. **Thêm fluid cho heading lớn** (#13 §7.1): `.page-title h1`, `.block-title h3`, `.newletters form h3`, `.slogan-bigbike` nên dùng `clamp()` (vd `clamp(1.75rem, 4vw, 4.375rem)`) thay vì cố định 50–61px trên mobile.
9. **Bỏ line-height = height px** (#12): dùng fl/grid + `align-items:center` thay cho `line-height:52px/62px/42px` để không gãy khi xuống dòng.

### 9.4 Giảm trùng lặp & nợ kỹ thuật

10. **Hợp nhất 8 file page CSS** (#19): tách phần dùng chung (`.form-group/.widget/.pagination/.product/.block-title`) ra 1 partial, các trang chỉ thêm phần riêng — chấm dứt lệch font giữa trang (#16,#20,#21).
11. **Chuyển rule chèn tay trong `dist/` về nguồn Gulp** (#22) để rebuild không mất; sau đó chỉ commit `dist/` do build sinh ra.
12. **Thống nhất màu** (#23,#24): 1 palette (`red`→`#ff0c09`; gộp ~20 sắc xám về 3–4 cấp; 1 cách viết `#fff`).
13. **Bổ sung fallback** `sans-serif` cho mọi `font-family` thiếu (#27).
14. **Dọn font mồ côi** (#6): xóa ~11MB file font không dùng trong `fonts/` (giữ icomoon + Barlow/Barlow Condensed nếu chuyển sang nạp từ file).
15. **Giảm `!important`** (#25,#26): refactor specificity thay vì đè.
16. **Quyết định RTL & style.css** (#29,#30): nếu không cần RTL, xóa `rtl.css`; cân nhắc enqueue lại phần heading của `style.css` hoặc bổ sung font-size h1–h6 trong CSS active.

---

## PHỤ LỤC — Định tuyến CSS theo trang (`inc/layout-functions.php`, `ENVIROMENT=production`)

| Loại trang | CSS được nạp (production) | Nguồn |
|---|---|---|
| **Trang chủ** (`page-home.php`) | `dist/home.min.css` | dòng 13–17 |
| **Sản phẩm đơn** (`is_product()`) | `dist/product-page.min.css` | dòng 32–37 |
| **Shop / Category / Brand / Search** | `fonts.css`(comment) + `main.css` + `product.css` + `custom.css` (**file rời** — nhánh `dist` bị comment dòng 66–69) | dòng 58–80 |
| **Còn lại** (page/category bài viết/cart/checkout…) | `dist/general-page.min.css` + (theo điều kiện) `news.css`/`news-detail.css`/`cart.css`/`check-out.css`/`login.css`/`register.css`/`static-page.css` | dòng 81–130 |
| **Trang liên hệ** (`page-contact.php`) | giữ contact-form-7; các trang khác `wp_deregister_style('contact-form-7')` | dòng 134–137 |
| **Mọi trang** | `footer.php` inline `<style>` (Barlow + Barlow Condensed + icomoon @font-face) | `footer.php:130-260` |

*Lưu ý:* trên trang dùng `dist/*` (home/product/general), `dist` đã bao gồm bản sao của `main.css`+page CSS+swiper; trên trang shop/category dùng file rời — đây là nguồn **trùng lặp `styles/` ↔ `dist/`** (#17).

---

*Hết báo cáo. Mọi phát hiện trích dẫn file nguồn theo CLAUDE.md. Các mục "Needs verification" cần kiểm tra trực tiếp trên trình duyệt/môi trường chạy thật.*
