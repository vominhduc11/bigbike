# URL_REDIRECT_MAP.md — bigbike.vn

Mapping URL cũ → URL mới khi chuyển sang Next.js. Ưu tiên **KEEP_SAME_URL** để không mất SEO.

Nguồn:
- `kd_options`: `permalink_structure='/tin-tuc/%postname%.html'`, `woocommerce_permalinks` (product_base=`/product`, category_base=`danh-muc-san-pham`, tag_base=`tu-khoa-san-pham`) — **các value này bị Permalink Manager Pro override**.
- `kd_options.permalink-manager_uris`: serialized map URI. Pattern verified:
  - Page: `%pagename%.html`
  - Product: `sp/%postname%.html`
  - Product category: `%product_cat%.html` (hierarchical per config `premmerce_permalink_manager.category=hierarchical`)
  - Brand: `brand/%pwb-brand%.html`
  - Video CPT: `video/%postname%.html` HOẶC `%video_slug%/%video%.html` (NEEDS_CONFIRMATION variant nào thực tế)
  - Blog post: `tin-tuc/%postname%.html`
  - Blog category: `%category%.html`
- `kd_options.premmerce_permalink_manager`: `category=hierarchical`, `product=slug`, `use_primary_category=on`, `canonical=on`.
- `kd_rank_math_redirections`: **40 row active** trong dump, mẫu đã verify (xem §2).
- Page IDs cố định: `woocommerce_shop_page_id=1` (slug `san-pham`), `cart=2` (slug `gio-hang`), `checkout=3` (slug `thanh-toan`), `myaccount=4` (slug `tai-khoan`).
- Polylang post IDs trong theme: 7968 (register slug `dang-ky`), 7970 (login slug `dang-nhap`), 10155 (lost password slug `quen-mat-khau`).
- Slug verified trong dump: `home`, `gio-hang`, `thanh-toan`, `dang-nhap`, `dang-ky`, `tai-khoan`, `lien-he`, `gioi-thieu`, `huong-dan`, `huong-dan-mua-hang` (page id 11), `quen-mat-khau`, `san-pham` (shop root page id 1).
- Polylang prefix `vi/` và `en/` **đã ngừng** phát hành — tất cả URL `vi/...` và `en/...` đều 301 về URL không prefix (xem `kd_rank_math_redirections` entries).

---

## 1. URL theo pattern

| Old URL pattern | New URL pattern | Redirect Type | Source | Priority | Status | Notes |
|---|---|---|---|---|---|---|
| `/` | `/` | KEEP_SAME_URL | page_id=12 | P0 | Confirmed | |
| `/sp/{slug}.html` | `/sp/{slug}.html` | KEEP_SAME_URL | Permalink Manager pattern `sp/%postname%.html` | P0 | Confirmed (verified qua 301 rows như entry 24, 33, 34, 35, 36, 37) | **1,227 product publish**. Ví dụ `/sp/giay-di-moto-phuot-tcx-ro4d-waterproof.html`. |
| `/product/{slug}/` (WC mặc định nếu còn URL nào leak) | `/sp/{slug}.html` | 301 | WC fallback | P1 | NEEDS_CONFIRMATION | Check whether any `/product/*` URL đã được Google index; nếu có, 301 sang `/sp/{slug}.html`. |
| `/{cat-slug}.html` | `/{cat-slug}.html` | KEEP_SAME_URL | Permalink Manager `%product_cat%.html` | P0 | Confirmed (target của redirect 3, 6, 8, 11, 30) | VD `/mu-bao-hiem.html`, `/phu-kien-khac.html`, `/gang-tay.html`, `/ao-quan-bao-ho.html`. |
| `/{parent-cat}/{child-cat}.html` | same | KEEP_SAME_URL | Permalink Manager hierarchical | P0 | Confirmed (target redirect 14, 16, 30) | VD `/mu-bao-hiem/mu-bao-hiem-fullface.html`, `/ao-quan-bao-ho/ao-bao-ho-vai-textile-jackets.html`. |
| `/{cat-slug}.html/page/{n}` | `/{cat-slug}.html?paged={n}` hoặc `/{cat-slug}.html/page/{n}` | 301 hoặc KEEP | WP pagination | P0 | Redirect 6/7/8/9/10/11/12/13 trong dump 301 các `/{cat}.html/page/N` về `/{cat}.html` — implying cat pagination ở live URL không có /page/N. NEEDS_CONFIRMATION actual rule | |
| `/danh-muc-san-pham.html` | `/danh-muc-san-pham.html` | KEEP_SAME_URL | page_id=1 slug `san-pham` rewrite | P0 | Confirmed (target redirect 6, 39) | Shop listing root. |
| `/danh-muc-san-pham.html/page/{n}` | `/danh-muc-san-pham.html` | 301 | `kd_rank_math_redirections` row 6 | P0 | Confirmed | Redirect về page 1. |
| `/danh-muc-san-pham/{slug}/` hoặc `/danh-muc-san-pham/{slug}.html` (WC default legacy) | `/{cat-slug}.html` | 301 | redirect 14, 16, 25 trong `kd_rank_math_redirections` | P0 | Confirmed | Với prefix `vi/danh-muc-san-pham/{slug}.html` cũng 301 về cùng target. |
| `/brand/{slug}.html` | `/brand/{slug}.html` | KEEP_SAME_URL | Permalink Manager pattern `brand/%pwb-brand%.html` | P0 | Confirmed (ví dụ `brand/agv.html`) | |
| `/pwb-brand/{slug}/` (WC default nếu leak) | `/brand/{slug}.html` | 301 | fallback | P1 | NEEDS_CONFIRMATION | |
| `/tu-khoa-san-pham/{slug}/` (product_tag) | giữ nguyên hoặc `noindex` | KEEP_SAME_URL | `woocommerce_permalinks.tag_base` | P2 | NEEDS_CONFIRMATION | Ít traffic. |
| `/tin-tuc/{slug}.html` | `/tin-tuc/{slug}.html` | KEEP_SAME_URL | `permalink_structure` | P0 | Confirmed | **174 posts** (verified — không phải 1,877). |
| `/tin-tuc/{slug-cũ-không-có-html}` | `/tin-tuc/{slug}.html` | 301 | redirect row 19, 20, 38 | P1 | Confirmed | Một số slug blog cũ không có `.html` đã được 301 cho URL hiện tại. |
| `/{blog-category}.html` | `/{blog-category}.html` | KEEP_SAME_URL | Permalink Manager `%category%.html` | P1 | Confirmed pattern | Slug cụ thể per blog category NEEDS_CONFIRMATION. |
| `/category/{slug}/` (WP default nếu leak) | `/{blog-category}.html` | 301 | fallback | P2 | NEEDS_CONFIRMATION | |
| `/tag/{slug}/` | `noindex` hoặc giữ nguyên | KEEP_SAME_URL | WP default; `tag_base=''` | P2 | NEEDS_CONFIRMATION | |
| `/gio-hang.html` (page_id=2) | `/gio-hang.html` | KEEP_SAME_URL | Permalink Manager `%pagename%.html` | P0 | Confirmed (guid trong kd_posts ID=2) | |
| `/thanh-toan.html` (page_id=3) | `/thanh-toan.html` | KEEP_SAME_URL | page_id=3 | P0 | Confirmed | |
| `/thanh-toan/order-received/{id}/` | `/thanh-toan/order-received/{id}/` | KEEP_SAME_URL | WC endpoint | P0 | Confirmed | Hard-coded trong `buy_quickly`. Trailing slash, không `.html`. |
| `/thanh-toan/order-pay/{id}/` | giữ nguyên | KEEP_SAME_URL | WC endpoint | P1 | NEEDS_CONFIRMATION | |
| `/dang-nhap.html` | `/dang-nhap.html` | KEEP_SAME_URL | page_id=7970 | P0 | Confirmed | |
| `/dang-ky.html` | `/dang-ky.html` | KEEP_SAME_URL | page_id=7968 | P0 | Confirmed | |
| `/quen-mat-khau.html` | `/quen-mat-khau.html` | KEEP_SAME_URL | page_id=10155 | P0 | Confirmed | |
| `/tai-khoan.html` | `/tai-khoan.html` | KEEP_SAME_URL | page_id=4 | P0 | Confirmed | |
| `/tai-khoan/orders/`, `/tai-khoan/view-order/{id}/`, `/tai-khoan/edit-account/`, `/tai-khoan/edit-address/{type}/`, `/tai-khoan/lost-password/` | WC endpoint format | KEEP_SAME_URL | WC default | P1 | NEEDS_CONFIRMATION URL pattern dưới `.html` cha — có thể thành `/tai-khoan.html/orders/` hoặc `/tai-khoan/orders/` | |
| `/lien-he.html` | `/lien-he.html` | KEEP_SAME_URL | page slug `lien-he` | P0 | Confirmed | |
| `/gioi-thieu.html` | `/gioi-thieu.html` | KEEP_SAME_URL | page slug | P0 | Confirmed | |
| `/huong-dan.html` | `/huong-dan.html` | KEEP_SAME_URL | page slug | P0 | Confirmed | |
| `/huong-dan-mua-hang.html` (page id 11) | same | KEEP_SAME_URL | page slug | P0 | Confirmed | |
| `/home/` hoặc `/home.html` | `/` | 301 | Legacy guid của page_id=12 | P0 | Confirmed | Canonical phải là `/`. |
| `/video/{slug}.html` | same | KEEP_SAME_URL | Permalink Manager pattern `video/%postname%.html` | P2 | Confirmed pattern, NEEDS_CONFIRMATION variant | 62 video posts. |
| `/{video_slug}/{video}.html` | same hoặc 301 → `/video/{slug}.html` | NEEDS_CONFIRMATION | Alt pattern trong URI map | P2 | NEEDS_CONFIRMATION | Chọn 1 variant canonical. |
| `/review/{slug}/` | n/a | — | Không có CPT `review` | P2 | Nếu có URL cũ, 410 hoặc 301 về blog post tương ứng | |
| `/wp-content/uploads/YYYY/MM/*` | `/wp-content/uploads/YYYY/MM/*` | KEEP_SAME_URL (proxy) | WordPress uploads | P0 | Confirmed | ~8GB media + 12,053 attachment rows, phải giữ path hoặc reverse-proxy |
| `/wp-admin/`, `/wp-admin/*` | `/admin/` (admin-fe) hoặc block public | 301 hoặc DENY | WP admin | P1 | NEEDS_CONFIRMATION | Sau cutover giữ origin nội bộ; block DNS public |
| `/wp-login.php` | block public (chỉ cho IP admin) | DENY | WP | P1 | NEEDS_CONFIRMATION | |
| `/wp-login.php?loginSocial=facebook` | `/dang-nhap/` (hoặc 410 nếu bỏ social login) | 301 hoặc 410 | Nextend Social Login (plugin inactive) | P2 | NEEDS_CONFIRMATION | |
| `/feed/`, `/*/feed/`, `/comments/feed/` | 410 | Remove | WP RSS (disabled by `disable-feeds-wp`) | P2 | Confirmed | |
| `/xmlrpc.php` | 410 | Remove | `disable-xml-rpc-api` plugin | P2 | Confirmed | |
| `/?p={id}` (unpretty permalink) | 301 → pretty URL | 301 | WP legacy | P1 | Confirmed | Pretty permalinks đã bật |
| `/?page_id={id}` | 301 → pretty URL | 301 | WP legacy | P1 | Confirmed | |
| `/?post_type=product&p={id}` | 301 → `/product/{slug}/` | 301 | WC | P1 | Confirmed | |
| `/sitemap_index.xml` | `/sitemap.xml` | 301 | RankMath sitemap | P0 | NEEDS_CONFIRMATION | Giữ index cũ redirect sang index mới |
| `/product-sitemap.xml`, `/post-sitemap.xml`, `/page-sitemap.xml`, `/category-sitemap.xml`, `/pwb-brand-sitemap.xml` | `/sitemap-{type}.xml` | 301 | RankMath | P0 | Confirmed | Google đã index sub-sitemap |
| `/robots.txt` | `/robots.txt` | KEEP_SAME_URL (nội dung thay đổi) | WP virtual | P0 | Confirmed | |
| `/wp-json/*` | Remove public access | DENY | WP REST | P1 | Confirmed | Backend mới có prefix `/api/` riêng |
| `/wp-json/contact-form-7/*` | `/api/contact/submit` | 301 hoặc API route mới | CF7 REST | P1 | NEEDS_CONFIRMATION | |
| `/wp-admin/admin-ajax.php?action=custom_*` | API route mới `/api/*` | DENY (không 301 vì là POST) | AJAX handlers | P0 | Confirmed | 8 custom handler phải chuyển sang endpoint mới có CSRF |
| Query string trên shop: `?pwb-brand=`, `?filter_color=`, `?filter_gender=`, `?min_price=`, `?max_price=`, `?paged=` | Giữ nguyên format | KEEP_SAME_URL | BR-15 | P0 | Confirmed | |

---

## 2. Historical redirects từ RankMath

Verified từ dump: **40 row** trong `kd_rank_math_redirections` (id 1..40). Phần lớn `status='active'`, vài row `inactive`. Các pattern chính:

- Pattern `vi/...` → 301 về URL không prefix (Polylang legacy): row 3, 4, 5, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 39.
- Pattern `*/page/N` trong category → 301 về URL không pagination: row 3, 6, 7, 8, 9, 10, 11, 12, 13.
- Pattern slug cũ (chuyển sang slug mới): row 1, 30, 32, 33, 34, 35, 36, 37.
- Pattern brand lẻ → filter URL với `?pwb-brand=`: row 17, 22, 23, 27.
- Pattern blog post slug cũ: row 2, 15, 19, 20, 38, 40.
- Pattern page cũ lỗi chính tả/dấu: row 32, 34, 37.
- Pattern chuyển domain: row 31 `sp/tai-nghe-bluetooth-intercom-scs-s-8.html` → `https://scsetc.bigbike.vn/...` (sub-brand domain).

Query export chính xác trên DB live:

```sql
SELECT id, sources, url_to, header_code, status, hits, last_accessed
FROM kd_rank_math_redirections
WHERE status = 'active'
ORDER BY id;
```

Migrate 1:1 vào table Redirect mới (xem [CONTENT_MODEL.md#314-redirect](CONTENT_MODEL.md#314--redirect)). Field `sources` là PHP serialized — cần deserialize thành nhiều source pattern mỗi row.

---

## 3. URL bắt buộc (absolute must-keep)

P0 URLs là **không thể mất**. Kiểm tra danh sách trước cutover bằng:

```sql
-- Top traffic page từ GSC (export CSV 90 ngày). Intersect với URL list.
-- Đối với URL không có trong GSC nhưng có nhiều internal link, crawl bằng Screaming Frog.
```

---

## 4. Rule tạo redirect tự động

Ngoài các rule trong bảng, cần tự động redirect:

1. Trailing slash: mọi URL không có trailing slash → 301 đến URL có trailing slash (theo convention WordPress hiện tại).
2. HTTPS: `http://bigbike.vn/*` → 301 `https://bigbike.vn/*`.
3. `www`: `www.bigbike.vn/*` → 301 `bigbike.vn/*` (NEEDS_CONFIRMATION: hiện www có redirect không).
4. Lowercase path: nếu URL có uppercase → 301 lowercase.
5. Multiple trailing slashes `//` → 301 canonical.

---

## 5. Edge cases cần quyết

| # | Case | Đề xuất |
|---|---|---|
| E1 | `/?s={q}` search URL được Google index | `noindex` + canonical về `/` (theo BR-16 hiện tại) |
| E2 | `/product/{slug}/?add-to-cart={id}` WC action URL | 301 → `/product/{slug}/` |
| E3 | `/?ppw_count_view={id}` (nếu có Perfect WC Brands widget) | Strip query string, canonical |
| E4 | `/wp-content/themes/bigbike/images/*` — ảnh theme | KEEP_SAME_URL (proxy) hoặc move sang `/static/*` và 301 |
| E5 | `/wp-content/plugins/*` — asset plugin được link nhúng trong content | Proxy |
| E6 | URL với UTM params | Preserve (không strip) |
| E7 | URL Polylang ngôn ngữ khác (e.g. `/en/product/...`) | NEEDS_CONFIRMATION — nếu chỉ support `vi`, 301 về URL `vi` tương đương, hoặc 410 |
| E8 | URL cũ có dấu tiếng Việt (rare) | 301 về ASCII |
| E9 | `/dang-ki/` (thiếu dấu) | 301 về `/dang-ky/` |
| E10 | `/feed/`, `/?feed=rss2` | 410 |

---

## 6. Implement trên main-fe

Hai tầng:

1. **Static redirects** (biết sẵn): `next.config.js` `redirects()` array. Thích hợp cho rule pattern tĩnh.
2. **Dynamic redirects** (từ DB): middleware Next.js lookup table `Redirect` qua Redis cache. Thích hợp cho `kd_rank_math_redirections` migrate.

```ts
// middleware.ts skeleton
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.pathname;
  const rule = await lookupRedirectCached(url);
  if (rule) {
    return NextResponse.redirect(new URL(rule.target, req.url), rule.statusCode);
  }
}
```

Cache TTL 300s, invalidation qua pub/sub khi admin-fe CRUD redirect.

---

## 7. Checklist trước cutover

- [ ] Export full URL list từ `kd_posts` (product+page+post+attachment+CPT).
- [ ] Export GSC top 1000 URL 90 ngày qua.
- [ ] Crawl Screaming Frog toàn site, lưu full URL inventory.
- [ ] Diff 3 list trên → xác định URL không có trong Next.js → cần redirect.
- [ ] Export `kd_rank_math_redirections` active rows → import vào Redirect mới.
- [ ] Test 1000 URL mẫu trên staging main-fe trước cutover.
- [ ] Monitor 404 rate 72h đầu sau cutover, target < 0.5% traffic.

---

## 8. Rollback strategy

Nếu sau cutover phát hiện > 5% URL 404:

1. Revert DNS về WordPress origin.
2. Điều tra pattern URL bị miss.
3. Thêm redirect hoặc đưa URL vào Next.js route handler.
4. Re-cutover sau khi test đủ 1000 URL mẫu thành công.

Xem [DEPLOYMENT_GUIDE.md#rollback-strategy](DEPLOYMENT_GUIDE.md#rollback-strategy).
