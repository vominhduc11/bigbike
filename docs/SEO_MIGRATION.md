# SEO_MIGRATION.md — bigbike.vn

Kế hoạch giữ SEO khi chuyển từ WordPress/WooCommerce sang Next.js (main-fe).

---

## 1. Engine SEO hiện tại

| Aspect | Phát hiện | Hành động |
|---|---|---|
| Plugin SEO active | `seo-by-rank-math/rank-math.php` | Engine chính — migrate `kd_rank_math_*` |
| RankMath modules active | `rank_math_modules` verified: link-counter, analytics, seo-analysis, sitemap, rich-snippet, woocommerce, buddypress, bbpress, acf, web-stories, instant-indexing, role-manager, redirections, 404-monitor | Sitemap + redirection + 404-monitor + ACF tích hợp đều đang dùng |
| Plugin SEO legacy | Yoast **KHÔNG** active (không có trong `active_plugins`), nhưng postmeta `_yoast_wpseo_*` + bảng `kd_yoast_*` vẫn tồn tại | Theme **vẫn đọc** `_yoast_wpseo_title` / `_yoast_wpseo_metadesc` / `_yoast_wpseo_primary_product_cat` ([woo-functions.php:501-638](files/wp-content/themes/bigbike/inc/woo-functions.php#L501-L638), [utils-functions.php:391-433](files/wp-content/themes/bigbike/inc/utils-functions.php#L391-L433)). Phải migrate cả 2 bộ metadata. |
| Sitemap | RankMath sitemap module. `rank_math_sitemap_cache_files` option đã verify — sitemap cache lưu tại `wp-content/uploads/rank-math/`. URL cũ có thể là `/sitemap_index.xml` (RankMath default). | Recreate sitemap trong Next.js |
| Redirect | `kd_rank_math_redirections` — **40 row verified** trong dump | Migrate các row `status='active'` (đa số) |
| 404 logs | `kd_rank_math_404_logs` — có entries, bao gồm probing scan như `wp-login.php`, `administrator`, `media/catalog/category`, v.v. | Tham khảo để phát hiện URL nên redirect hoặc block |
| GTM container | GTM-5BKZL3K (verified trong header.php:150) | Tái sử dụng cùng container |
| Facebook domain verification | `a5hwdqc9uvn7hkcfzxs340aot5w0xj` (verified header.php:28) | Giữ meta tag |
| Google Search Console verification | 2 token verified header.php:29-30 (`qo8TuiPpS5h9UP4wmdr6sEcsV30v24WFOehy8DG3AoY`, `f-wRuUudb-XJeLSWtRPK_ywvhMoFPH79h6ysZTvUYNc`) | Giữ meta tag hoặc chuyển sang verify qua TXT record DNS |

---

## 2. Mapping meta title

| Nguồn hiện tại | Thứ tự ưu tiên | Ghi chú |
|---|---|---|
| `postmeta.rank_math_title` | 1 | Nếu có, dùng trực tiếp |
| `postmeta._yoast_wpseo_title` | 2 | Fallback |
| Theme `custom_document_title` rule | 3 | Chỉ áp dụng cho shop/category: base title + " - {brand} - Dành cho {gender} - Giá ... - Trang N - Màu {color}". Phải reimplement trong main-fe. |
| `post_title` + " - " + `blogname` | 4 | Fallback cuối |

Trong main-fe: build title theo rule sau:

```ts
// Pseudocode
function buildTitle(entity, context) {
  const base = entity.seo?.meta_title ?? legacyYoastTitle(entity) ?? entity.name;
  const filterSuffix = context.isShopOrCategory ? buildFilterSuffix(context.query) : "";
  return filterSuffix ? `${base} - ${filterSuffix}` : `${base} - Bigbike.vn`;
}

function buildFilterSuffix(query) {
  const parts = [];
  if (query.brand) parts.push(` ${query.brand.name}`);
  if (query.gender === "nam") parts.push("Dành cho Nam");
  if (query.gender === "nu") parts.push("Dành cho Nữ");
  if (query.minPrice || query.maxPrice) parts.push(buildPriceLabel(query));
  if (query.color) parts.push(`Màu ${query.color.name}`);
  if (query.paged && query.paged > 1) parts.push(`Trang ${query.paged}`);
  return parts.join(" - ");
}
```

Evidence rule: [inc/woo-functions.php:459-581](files/wp-content/themes/bigbike/inc/woo-functions.php#L459-L581).

---

## 3. Mapping meta description

Thứ tự ưu tiên giống title:
1. `rank_math_description`
2. `_yoast_wpseo_metadesc`
3. Theme custom description rule (shop/category) — giống rule title nhưng dùng description term/page làm base (xem `custom_document_description` [woo-functions.php:585-638](files/wp-content/themes/bigbike/inc/woo-functions.php#L585-L638))
4. `post_excerpt`
5. Fallback: 160 ký tự đầu của `post_content` (strip HTML)

---

## 4. Canonical URL

| Trang | Canonical hiện tại | Canonical mới |
|---|---|---|
| Home `/` | `https://bigbike.vn/` (header.php có `hreflang="x-default"` về `https://bigbike.vn/`) | Giữ nguyên |
| Product | Chính URL `/sp/{slug}.html` (RankMath + Premmerce config `canonical=on`) | Giữ nguyên `/sp/{slug}.html` |
| Product category | Chính URL `/{cat-slug}.html` hoặc `/{parent}/{child}.html` | Giữ nguyên |
| Brand | Chính URL `/brand/{slug}.html` | Giữ nguyên |
| Blog post | `/tin-tuc/{slug}.html` | Giữ nguyên |
| Shop với filter query (`?pwb-brand=…`, `?filter_color=…`, `?filter_gender=…`, `?min_price=…`, `?max_price=…`, `?paged=…`) | Hiện tại WordPress không gắn canonical riêng — RankMath default | **Áp dụng `noindex`** cho combination filter phi-canonical; set canonical = URL không query cho các filter thông thường; giữ canonical riêng cho filter single brand nếu muốn index |
| Search | Hard-coded `<meta name="canonical" content="https://bigbike.vn/">` (BR-16) — **sai semantic** (`<meta>` thay cho `<link rel="canonical">`) | **Fix:** dùng `<link rel="canonical" href="https://bigbike.vn/">` + thêm `noindex`. |
| 404 | Không có | Set `noindex` |
| Cart / Checkout / My Account | Không có | `noindex, nofollow` |
| Login / Register / Lost password | Không có | `noindex` |

Về `hreflang`:
- Hiện tại chỉ có `<link rel="alternate" hreflang="x-default" href="https://bigbike.vn/">` trong `header.php`. Polylang có thể đang publish bản dịch ngôn ngữ thứ hai — NEEDS_CONFIRMATION.
- Nếu chỉ xuất bản `vi`: chỉ cần `x-default` và `vi`.

---

## 5. Open Graph / Twitter Card

Theme có:
- Meta `facebook-domain-verification` = `a5hwdqc9uvn7hkcfzxs340aot5w0xj`
- Meta `google-site-verification` = 2 giá trị khác nhau trong [header.php:29-30](files/wp-content/themes/bigbike/header.php#L29-L30)
- Filter `wpseo_opengraph_image_size` → size `facebook-share` (1200x630) cho OG image (Yoast hook — RankMath cũng tương thích)

OG tags do RankMath/Yoast sinh ra tự động. Migration cần tạo lại:

| Tag | Nguồn |
|---|---|
| `og:site_name` | Site config "Bigbike.vn" |
| `og:title` | = meta title |
| `og:description` | = meta description |
| `og:url` | canonical URL |
| `og:type` | `article` cho blog, `product` cho product, `website` cho còn lại |
| `og:image` | (a) RankMath OG image postmeta nếu có, (b) `_yoast_wpseo_opengraph-image` (Yoast cũ), (c) featured image size `facebook-share` (1200×630, đã add_image_size trong theme), (d) default logo `/wp-content/themes/bigbike/images/logo.png` |
| `og:image:width` / `og:image:height` | 1200 × 630 |
| `og:locale` | `vi_VN` |
| `twitter:card` | `summary_large_image` |
| `twitter:title` | = meta title |
| `twitter:description` | = meta description |
| `twitter:image` | = og:image |
| Schema.org JSON-LD | Xem §6 |

---

## 6. Structured Data (JSON-LD)

Từ source hiện tại:

### 6.1 Organization (trang chủ + global `<head>`)
Có sẵn trong [header.php:51-107](files/wp-content/themes/bigbike/header.php#L51-L107) — loại `AutoBodyShop`. Copy nguyên vào main-fe.

```json
{
  "@context":"https://schema.org",
  "@type":"AutoBodyShop",
  "name":"Bigbike",
  "image":"https://bigbike.vn/.../logo.png",
  "@id":"https://bigbike.vn/#AutomotiveBusiness",
  "url":"https://bigbike.vn/",
  "telephone":"+842862797251",
  "priceRange":"$100",
  "address":{...},
  "openingHoursSpecification":[...]
}
```

### 6.2 Product (trên single-product)
Cần emit:
- `@type`: `Product`
- `name`, `sku`, `description`, `image[]`, `brand` (ref Brand), `offers` với `priceCurrency="VND"`, `price`, `availability`, `url`
- `aggregateRating` với `ratingValue` (từ ACF rating, default 4.5) và `reviewCount` (ACF rating_count, default 124) — **cảnh báo:** giá trị đang là cosmetic. Stakeholder cần quyết định có emit rating giả không (rủi ro Google manual action).

Evidence: [content-single-product.php:69-87](files/wp-content/themes/bigbike/woocommerce/content-single-product.php#L69-L87) đã emit `itemprop="name"`, `itemprop="aggregateRating"`, `itemprop="ratingValue"`, `itemprop="reviewCount"` theo microdata.

### 6.3 BreadcrumbList (mọi archive + single)
Breadcrumb NavXT đang chịu trách nhiệm. Reimplement structured data dạng:

```json
{
  "@type":"BreadcrumbList",
  "itemListElement":[
    {"@type":"ListItem", "position":1, "name":"Trang chủ", "item":"https://bigbike.vn/"},
    {"@type":"ListItem", "position":2, "name":"Mũ bảo hiểm", "item":"https://bigbike.vn/danh-muc-san-pham/mu-bao-hiem/"}
  ]
}
```

### 6.4 Article (trên blog post)
- `@type`: `Article`
- `headline`, `image`, `datePublished`, `dateModified`, `author`, `publisher`

### 6.5 WebSite + SearchAction
Emit trên trang chủ:
```json
{"@type":"WebSite", "potentialAction": {"@type":"SearchAction", "target":"https://bigbike.vn/?s={search_term_string}", ...}}
```

---

## 7. Sitemap strategy

Sitemap hiện tại do RankMath sinh (lưu cấu hình trong `kd_options.rank_math_sitemap_*`).

Kế hoạch main-fe:

| Sitemap | URL | Cập nhật |
|---|---|---|
| Index | `/sitemap.xml` | Build theo lịch (cron) + on-demand qua revalidate |
| Products | `/sitemap-products.xml` | Chunk 500/file nếu > 5000 URL (ở đây có 21,678 product → ~44 chunk). Option: `/sitemap-products-{page}.xml` |
| Product categories | `/sitemap-product-cat.xml` | |
| Brands | `/sitemap-brand.xml` | |
| Posts | `/sitemap-posts.xml` | |
| Pages | `/sitemap-pages.xml` | |
| Videos (nếu migrate) | `/sitemap-videos.xml` | |

Content per URL: `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>`. Với Next.js dùng `app/sitemap.ts` hoặc custom API.

Lưu ý: RankMath sitemap sinh ra URL dạng `https://bigbike.vn/product-sitemap.xml`, `post-sitemap.xml`... Nếu URL sitemap đã được submit lên Google Search Console, có thể cần 301 sitemap cũ → sitemap mới.

---

## 8. Robots.txt

Hiện tại WordPress sinh `robots.txt` virtual (không có file thật trong snapshot tại `files/robots.txt`). Nội dung virtual mặc định tương đương:

```
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Sitemap: https://bigbike.vn/sitemap_index.xml
```

Khuyến nghị main-fe `public/robots.txt`:

```
User-agent: *
Disallow: /api/
Disallow: /gio-hang/
Disallow: /thanh-toan/
Disallow: /tai-khoan/
Disallow: /dang-nhap/
Disallow: /dang-ky/
Disallow: /quen-mat-khau/
Disallow: /*?*s=
Disallow: /*?paged=
Allow: /
Sitemap: https://bigbike.vn/sitemap.xml
```

Thêm `User-agent: MJ12bot\nDisallow: /` và các bot nhiễu khác tùy chính sách.

---

## 9. Breadcrumb strategy

Hiện tại theme gọi `get_custom_template('content-breadcrumbs')` — template partial không dùng plugin mà render trực tiếp (NEEDS_CONFIRMATION nội dung file `template-parts/content-breadcrumbs.php`).

Main-fe cần tự render breadcrumb:
- Shop: Trang chủ > Shop
- Product category: Trang chủ > Danh mục sản phẩm > {Category name}
- Brand: Trang chủ > Thương hiệu > {Brand name}
- Product detail: Trang chủ > Danh mục sản phẩm > {Primary category} > {Product name}
- Blog: Trang chủ > Tin tức > {Category} > {Post title}
- Static page: Trang chủ > {Page title}

Phải emit structured data `BreadcrumbList` song song với HTML breadcrumb.

---

## 10. URL preservation strategy

Xem chi tiết [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md). Nguyên tắc:

1. **KEEP_SAME_URL** cho toàn bộ URL SEO-critical:
   - `/product/{slug}/` (21,678 products)
   - `/danh-muc-san-pham/{slug}/`
   - `/pwb-brand/{slug}/`
   - `/tin-tuc/{slug}.html`
   - Page slugs: `/`, `/gio-hang/`, `/thanh-toan/`, `/dang-nhap/`, `/dang-ky/`, `/tai-khoan/`, `/lien-he/`, `/gioi-thieu/`, `/huong-dan/`, `/quen-mat-khau/`.
2. **301** cho URL đã tồn tại nhưng logic thay đổi (ví dụ: `/wp-login.php?loginSocial=facebook` → `/dang-nhap/` nếu social login bị bỏ).
3. **410** cho URL cố tình remove (feed, RSS).
4. Không bao giờ trả 302 cho URL SEO-critical.

---

## 11. URL bắt buộc KHÔNG được mất

| URL / pattern | Lý do bắt buộc |
|---|---|
| `/` | Landing SEO |
| `/sp/*.html` | **1,227 product** publish (verified) Google đã index |
| `/{cat-slug}.html` + `/{parent}/{child}.html` | Category URL (Permalink Manager `%product_cat%.html`) |
| `/brand/*.html` | Brand URL (Permalink Manager `brand/%pwb-brand%.html`) |
| `/tin-tuc/*.html` | **174 blog post** publish (verified) |
| `/{blog-category}.html` | Blog category URL (Permalink Manager `%category%.html`) |
| `/video/*.html` hoặc `/{video_slug}/{video}.html` | **62 video posts** (verified — 1 trong 2 pattern canonical, NEEDS_CONFIRMATION variant) |
| `/gio-hang.html`, `/thanh-toan.html`, `/tai-khoan.html`, `/dang-nhap.html`, `/dang-ky.html`, `/lien-he.html`, `/gioi-thieu.html`, `/huong-dan.html`, `/huong-dan-mua-hang.html`, `/quen-mat-khau.html`, `/danh-muc-san-pham.html` | Page chính (Permalink Manager `%pagename%.html`) |
| `/wp-content/uploads/*` | ~8GB media URL đã được index / share |
| `/sitemap_index.xml`, `/product-sitemap.xml`, `/post-sitemap.xml`, `/page-sitemap.xml`, `/pwb-brand-sitemap.xml`, `/product_cat-sitemap.xml`, ... | RankMath sitemap đã submit lên GSC (NEEDS_CONFIRMATION số lượng sub-sitemap thực) — 301 sang sitemap mới |

---

## 12. Checklist SEO sau migration

Functional:
- [ ] Mọi URL cũ trả 200 hoặc 301 đến URL tương đương. Không có URL nào bất ngờ 404/500.
- [ ] `sitemap.xml` + sub-sitemaps hợp lệ XML, không >50k URL per file.
- [ ] `robots.txt` ở `/robots.txt` trả 200, cho phép crawl chính, block checkout/cart/account.
- [ ] Mỗi URL có `<title>` + `<meta name="description">` đúng.
- [ ] Mỗi URL có `<link rel="canonical">` đúng.
- [ ] Mỗi URL có OG tags + Twitter card.
- [ ] Breadcrumb HTML + JSON-LD.
- [ ] Product JSON-LD với `priceCurrency=VND` và `availability` đúng.
- [ ] Organization JSON-LD trên home.
- [ ] Article JSON-LD trên blog.
- [ ] WebSite SearchAction trên home.
- [ ] `hreflang` đúng nếu nhiều ngôn ngữ.

Validation:
- [ ] Chạy Google Rich Results Test trên URL mẫu mỗi loại.
- [ ] Chạy PageSpeed Insights trên home + product detail + shop. Core Web Vitals đạt xanh.
- [ ] Screaming Frog crawl full site, không có URL broken link internal.
- [ ] Submit sitemap mới lên Google Search Console.
- [ ] Monitor GSC Coverage report trong 30 ngày sau launch.

Content:
- [ ] 100% meta title hiện tại (RankMath + Yoast fallback) được migrate.
- [ ] 100% meta description migrate.
- [ ] 100% `rank_math_redirections` active migrate.
- [ ] Featured image → OG image đúng size 1200×630.
- [ ] Alt text theo rule (ưu tiên `_wp_attachment_image_alt`, fallback theme rule = product title).

Monitoring:
- [ ] Dashboard Search Console: impressions/clicks/position 30-60-90 ngày so với baseline pre-migration.
- [ ] 404 rate monitoring. Tất cả 404 > 1% tổng traffic phải được điều tra.
- [ ] Log redirect chain — không có chain > 1 hop.

---

## 13. Rủi ro SEO lớn nhất

| # | Rủi ro | Mức độ | Mitigation |
|---|---|---|---|
| S1 | Mất meta title/desc do 2 engine SEO (RankMath + Yoast residual) không gộp đúng | Cao | Merge script: ưu tiên RankMath, fallback Yoast, validate thủ công top 500 URL |
| S2 | Product JSON-LD với rating cosmetic (4.5/124) có thể bị Google đánh giá sai | Cao | Decision: (a) bỏ hẳn, (b) chỉ emit khi có review thật, (c) migrate cả "fake" rating (rủi ro manual action) |
| S3 | Mất 301 redirect của RankMath Redirections | Trung | Export + import sang table Redirect mới |
| S4 | Media broken link sau khi đổi storage | Cao | Giữ path `/wp-content/uploads/*` qua reverse proxy hoặc phát hành rewrite tương ứng |
| S5 | Sitemap URL thay đổi | Thấp | Giữ `/sitemap_index.xml` 301 → `/sitemap.xml` |
| S6 | Google re-crawl chậm → traffic giảm tạm thời | Trung | Submit sitemap mới ngay sau cutover; Ping Google/Bing |
| S7 | Query string filter pages (`?pwb-brand=...`) đang không có `noindex` → duplicate content | Trung | Áp `noindex` cho filter combination không phải canonical |
| S8 | Lost password page (page id 10155) chưa verify slug | Thấp | Verify trước khi migrate |
| S9 | hreflang missing nếu Polylang xuất bản 2 ngôn ngữ | Trung | Verify Polylang; emit hreflang đầy đủ |
| S10 | Deactivate WordPress trước khi verify Google đã index URL mới | Cao | Giữ WordPress song song 30 ngày, DNS switch cuối cùng |
