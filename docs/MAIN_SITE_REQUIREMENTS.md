# MAIN_SITE_REQUIREMENTS.md — main-fe (Next.js public site)

Yêu cầu chức năng cho public storefront mới. **Không bao gồm thiết kế giao diện.** Lấy nguồn từ [API_FLOW_MAP.md](API_FLOW_MAP.md), [BUSINESS_PROCESS.md](BUSINESS_PROCESS.md), [PAGE_INVENTORY.md](PAGE_INVENTORY.md).

---

## 1. Phạm vi

main-fe phục vụ toàn bộ traffic `bigbike.vn` với các yêu cầu cốt lõi:

1. SEO-first (SSR/SSG/ISR, structured data, sitemap, canonical, OG).
2. URL identical với hiện tại (xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md)).
3. Performance: LCP < 2.5s, CLS < 0.1, INP < 200ms ở 75th percentile trên mobile 4G.
4. Không public bất kỳ endpoint quản trị.
5. Tách biệt hoàn toàn khỏi admin-fe (deploy riêng, domain khác nếu cần).

---

## 2. Routes

| Route | Purpose | Data Needed | Rendering Strategy | SEO | Notes |
|---|---|---|---|---|---|
| `/` | Home | Featured products (3), featured carousel (5), categories `show_on_homepage=1`, 5 brands, 3 blog "Tin tức" (cat 361), 3 review "Trải nghiệm" (cat 365), 5 videos, sliders, ACF `about_us`, `blog_content`, `content_bottom` | ISR 15 min + on-demand revalidate khi admin edit | Organization JSON-LD + WebSite SearchAction | Bắt buộc |
| `/shop/` (tương đương page_id=1) | Shop listing | Products paginated 24/page | ISR 5 min | Title rule brand/gender/price/color (BR-15) | NEEDS_CONFIRMATION slug thực |
| `/shop/page/{n}/` | Shop page N | — | ISR | Canonical = page 1 nếu filter rỗng | |
| `/danh-muc-san-pham/{slug}/[page/{n}/]` | Product category | Products + ACF top_image/image_left/content_bottom | ISR 5 min | Title override + Breadcrumb JSON-LD | |
| `/pwb-brand/{slug}/[page/{n}/]` | Brand | Products + brand logo | ISR 5 min | Title + breadcrumb | |
| `/product/{slug}/` | Product detail | Product + variations + gallery + reviews + related (8 by primary category) + ACF rating/rating_count/content_bottom/videos | ISR 15 min | Product JSON-LD + Breadcrumb + AggregateRating | |
| `/tin-tuc/{slug}.html` | Blog post detail | Post + author + categories + tags + featured image + related | ISR 30 min | Article JSON-LD + Breadcrumb | |
| `/category/{slug}/[page/{n}/]` | Blog category | Posts list | ISR 10 min | Breadcrumb | |
| `/tag/{slug}/` | Blog tag | Posts list | ISR 30 min hoặc `noindex` | NEEDS_CONFIRMATION |
| `/gio-hang/` | Cart | WC cart session | SSR (dynamic) + CSR update | `noindex, nofollow` | |
| `/thanh-toan/` | Checkout | Cart + addresses + payment methods + shipping methods | SSR | `noindex, nofollow` | |
| `/thanh-toan/order-received/{id}` | Order received | Order by id + key | SSR | `noindex` | Emit GTM `purchase` |
| `/dang-nhap/` | Login form | — | SSG | `noindex` | Redirect nếu đã login |
| `/dang-ky/` | Register form | — | SSG | `noindex` | Redirect nếu đã login |
| `/quen-mat-khau/` | Lost password | — | SSG + POST API | `noindex` | |
| `/tai-khoan/` | My Account dashboard | Current user | SSR | `noindex, nofollow` | Auth-gated |
| `/tai-khoan/orders/` | Order history | Orders of user | SSR | `noindex` | |
| `/tai-khoan/view-order/{id}/` | Order detail | Order | SSR | `noindex` | |
| `/tai-khoan/edit-account/` | Edit profile | User | SSR | `noindex` | |
| `/tai-khoan/edit-address/{billing\|shipping}/` | Edit address | Address | SSR | `noindex` | |
| `/tai-khoan/lost-password/?action=rp&key=...` | Reset password | — | SSR | `noindex` | |
| `/lien-he/` | Contact | Page content + ACF `contact_form`, `iframe_maps`, `note` | SSG | Meta | Form submit via API `/api/contact/submit` |
| `/gioi-thieu/` | About | Page content | SSG + ISR 30 min | Meta | |
| `/huong-dan/[...sub]/` | Guide | Page content + menu `guide` | SSG | Meta | Hierarchical |
| `/video/{slug}/` | Video detail | CPT `video` | SSG | Meta | NEEDS_CONFIRMATION URL |
| `/review/{slug}/` | Review detail | CPT `review` | SSG | Meta | NEEDS_CONFIRMATION URL |
| `/{page-slug}/` | Static page fallback (gioi-thieu, chinh-sach-*, etc.) | Page by slug | SSG + ISR | Meta | Catch-all cho 80 page |
| `/sitemap.xml` | Sitemap index | All published URLs | Static + revalidate | — | |
| `/sitemap-products.xml`, ... | Sub-sitemaps | | Static + revalidate | — | Chunk 500-1000 URL/file |
| `/robots.txt` | Robots | — | Static | — | |
| `/404` (via notFound) | 404 error | — | SSG | `noindex` | |
| `/search` (internal) hoặc `/?s={q}` | Search results | Products + posts matching | SSR | `noindex, canonical=/` | Search logic BR-10 |

---

## 3. Data source / API

main-fe lấy data từ backend/API (hoặc headless WordPress tạm thời — xem [PROJECT_OVERVIEW.md#7-phương-án-tạm](PROJECT_OVERVIEW.md#7-phương-án-tạm-phase-chuyển-tiếp)).

| Route | Endpoint API (đề xuất) | Method | Auth |
|---|---|---|---|
| Home | `GET /api/public/home` | GET | Public |
| Shop list | `GET /api/public/products?category=&brand=&color=&gender=&min_price=&max_price=&page=&sort=` | GET | Public |
| Product detail | `GET /api/public/products/{slug}` | GET | Public |
| Variation lookup | `POST /api/public/products/{id}/match-variation` | POST | Public; thay thế API-08 |
| Category detail | `GET /api/public/categories/{slug}` | GET | Public |
| Brand detail | `GET /api/public/brands/{slug}` | GET | Public |
| Blog post list | `GET /api/public/posts?category=&tag=&page=` | GET | Public |
| Blog post detail | `GET /api/public/posts/{slug}` | GET | Public |
| Page by slug | `GET /api/public/pages/{slug}` | GET | Public |
| Menu | `GET /api/public/menus/{location}` | GET | Public |
| Cart | `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/{key}`, `DELETE /api/cart/items/{key}` | CRUD | Session token; CSRF |
| Apply coupon | `POST /api/cart/coupon` | POST | Session + CSRF |
| Checkout | `POST /api/orders` | POST | Session + CSRF |
| Quick Buy (thay API-07) | `POST /api/orders/quick-buy` | POST | Rate-limited + CAPTCHA + CSRF |
| Login | `POST /api/auth/login` | POST | CSRF |
| Register | `POST /api/auth/register` | POST | CSRF + CAPTCHA |
| Logout | `POST /api/auth/logout` | POST | Auth + CSRF |
| Refresh token | `POST /api/auth/refresh` | POST | Refresh token |
| Lost password | `POST /api/auth/password/forgot` | POST | CSRF |
| Reset password | `POST /api/auth/password/reset` | POST | Token |
| My profile | `GET /api/account/me` | GET | Auth |
| Update profile (thay API-03) | `PATCH /api/account/me` | PATCH | Auth + CSRF |
| My orders | `GET /api/account/orders` | GET | Auth |
| Order detail | `GET /api/account/orders/{id}` | GET | Auth + ownership |
| Contact submit | `POST /api/contact/submit` | POST | CSRF + CAPTCHA |
| Search | `GET /api/public/search?q=` | GET | Public |

Chi tiết API xem [CONTENT_MODEL.md](CONTENT_MODEL.md) cho shape.

---

## 4. Rendering strategy per route

| Chiến lược | Áp dụng | Lý do |
|---|---|---|
| **SSG** (static generation build-time) | Static pages ít đổi: `/gioi-thieu/`, `/lien-he/`, `/dang-nhap/`, `/dang-ky/`, `/quen-mat-khau/`, `/huong-dan/` | Nội dung gần như không đổi |
| **ISR** (build at request + revalidate) | Home, shop, category, brand, product detail, blog | Cân bằng performance vs freshness. Revalidate 5–30 min. |
| **On-demand ISR** | Admin edit product/category/post → gọi `revalidateTag`/`revalidatePath` từ admin-fe | Đảm bảo content fresh |
| **SSR** (mỗi request render server) | Cart, Checkout, Order received, My Account, Search results | Có per-user data hoặc query-string khác nhau |
| **CSR** (React Client Component) | Add-to-cart button, variation picker, filter UI, quantity stepper | Interactivity |

---

## 5. Sitemap inclusion

| Route | Include trong sitemap | Priority | changefreq |
|---|---|---|---|
| `/` | Yes | 1.0 | daily |
| `/product/{slug}/` | Yes | 0.8 | weekly |
| `/danh-muc-san-pham/{slug}/` | Yes | 0.7 | weekly |
| `/pwb-brand/{slug}/` | Yes | 0.6 | weekly |
| `/tin-tuc/{slug}.html` | Yes | 0.6 | monthly |
| `/category/{slug}/` | Yes | 0.5 | weekly |
| Static pages | Yes | 0.5 | yearly |
| Cart / Checkout / Account / Login / Register | **No** | — | — |
| Search | **No** | — | — |
| 404 | **No** | — | — |

Sitemap chunking: product sitemap split 500 URL/file → ~44 file.

---

## 6. Error / empty / loading behaviour

| Route | Loading | Empty | Error |
|---|---|---|---|
| Home | Skeleton các section | Fallback text section | Server error page với liên hệ |
| Shop / category / brand | Skeleton grid | "Không có sản phẩm nào phù hợp" | 500 page |
| Product detail | Skeleton gallery + info | 404 nếu slug không tồn tại | 500 page |
| Cart | Skeleton rows | "Giỏ hàng trống" + CTA "Tiếp tục mua" | Toast error |
| Checkout | Skeleton form | Redirect `/gio-hang/` nếu empty cart | Inline field errors + toast |
| My Account | Skeleton | — | Redirect `/dang-nhap/` nếu 401 |
| Search | Skeleton | "Không tìm thấy kết quả cho..." | — |
| Blog listing | Skeleton | "Chưa có bài viết" | — |
| 404 | — | Static 404 page với menu + search | — |

Tất cả trang phải có **loading.tsx** (App Router) cho Suspense boundary, và **error.tsx** cho error boundary.

---

## 7. Search / filter requirement

Tương ứng BR-10, BR-15. UI state phải sync với URL query string để copy-paste share được:
- `?pwb-brand={slug}` — brand filter
- `?filter_color={slug}` — color filter
- `?filter_gender=nam|nu` — gender filter
- `?min_price=X&max_price=Y` — price range
- `?paged=N` — pagination
- `?orderby=price|popularity|date|...` — sort

Filter submission:
- Shop sidebar (devvn-woocommerce-price-filter) reimplement bằng client component.
- Multi-select có debounce 300ms.
- Filter tương thích với SSR: initial state parse từ URL trong server component.

Shop title override: xem [SEO_MIGRATION.md#2-mapping-meta-title](SEO_MIGRATION.md#2-mapping-meta-title).

---

## 8. Form requirement

Form nào, cách submit, validation:

| Form | Submit | Validation | API |
|---|---|---|---|
| Login | POST `/api/auth/login` | username (required), password ≥ 6 | JSON response + set cookie |
| Register | POST `/api/auth/register` | phone = 10 digits, unique; email valid, unique; password ≥ 6; repassword == password; fullname required | + CAPTCHA |
| Lost password | POST `/api/auth/password/forgot` | username hoặc email | Silent thành công để tránh enumeration |
| Reset password | POST `/api/auth/password/reset` | token + new password ≥ 6 | |
| Update profile | PATCH `/api/account/me` | optional old_password + new ≥ 6 + confirm | Require re-enter password cho sensitive change |
| Contact (CF7) | POST `/api/contact/submit` | fields theo form config | + CAPTCHA |
| Checkout billing/shipping | POST `/api/orders` | billing_phone = 10 digits, required billing + shipping fields | + CSRF + cart nonce |
| Quick Buy | POST `/api/orders/quick-buy` | name, phone (10 digits), address, product_id | + CAPTCHA + rate-limit (max 3/min/IP) |
| Coupon | POST `/api/cart/coupon` | code (required, uppercase) | Return cart totals |

Sử dụng `react-hook-form` + Zod/Yup cho validation đồng nhất FE + API schema.

---

## 9. Performance requirement

| Metric | Target (mobile 4G) |
|---|---|
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| TTFB | < 600ms (home), < 800ms (product) |
| JS bundle initial route | < 180KB gzipped |
| Image: `next/image` mặc định, lazy, AVIF/WebP auto |
| Font: subset Vietnamese, `display=swap` |

Techniques:
- Aggressive use of `Suspense` + `streaming`.
- Prefetch route on hover (Next.js built-in).
- CDN edge cache `Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400` cho HTML.
- Split `app/(marketing)`, `app/(shop)`, `app/(account)` route groups để bundle nhỏ.

---

## 10. Security consideration

- **CSRF token** cho mọi mutation (double-submit cookie hoặc SameSite=strict cookie + header).
- **Rate limiting** tại reverse proxy (Nginx/Cloudflare) và tại API (Redis).
- **CAPTCHA** (hCaptcha/Turnstile) cho register, quick-buy, contact, password-reset.
- **Session cookie** HttpOnly, SameSite=Lax (Strict cho account routes), Secure, path=/.
- **Content-Security-Policy** whitelist: self + GTM + CDN media + Google Maps + font sources.
- **Referrer-Policy** = `strict-origin-when-cross-origin`.
- **HSTS** enabled (sau khi confirm HTTPS cover toàn sub-domain).
- **XSS protection** bằng sanitize HTML server-side trước khi lưu, hoặc render `dangerouslySetInnerHTML` chỉ cho content đã sanitize.
- **SQL injection**: dùng ORM + parameterized query.
- Không expose WordPress endpoint (xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md) — block `/wp-admin`, `/wp-json`, `/wp-login.php`, `/xmlrpc.php`).

---

## 11. Phụ thuộc cross-route / global

- Header + footer + mini-cart hiển thị trên mọi route.
- Mini-cart có badge count, dropdown hiển thị 3 item mới nhất, bắt buộc update khi add/remove.
- Language switcher (nếu Polylang support >1 ngôn ngữ): phase 2.
- Search icon header → input inline.
- Floating "hotline" button (Zalo/Phone).

---

## 12. Analytics / tracking

- Google Tag Manager container (ID NEEDS_CONFIRMATION — từ `header.php` không có inline GTM ID; có thể load qua plugin).
- Events:
  - `page_view` (mỗi route change)
  - `view_item` (product detail)
  - `view_item_list` (shop/category)
  - `select_item` (click product card)
  - `add_to_cart`, `remove_from_cart`
  - `view_cart`
  - `begin_checkout`, `add_shipping_info`, `add_payment_info`
  - `purchase` (order received)
- Facebook Pixel (NEEDS_CONFIRMATION tồn tại — thấy `facebook-domain-verification` trong header).

---

## 13. Accessibility

- Dùng semantic HTML.
- Nav `<nav aria-label=...>`.
- Form `<label>` liên kết với input.
- Button có `aria-label` nếu chỉ chứa icon.
- Color contrast AA tối thiểu.
- Keyboard navigation đầy đủ.

---

## 14. Dependency list tối thiểu

| Package | Mục đích |
|---|---|
| `next` ≥ 14 (App Router) | Framework |
| `react`, `react-dom` | Core |
| `tailwindcss` | Styling (không bàn design chi tiết) |
| `zod` | Validation |
| `react-hook-form` | Form |
| `@tanstack/react-query` (or native fetch cache) | Client-side data fetching cho cart |
| `next-intl` hoặc custom i18n | Đa ngôn ngữ Polylang |
| `js-cookie` hoặc native | Session cookie helper |
| `dompurify` (client) + sanitize server-side | HTML render an toàn |
| `zod-i18n-map` (optional) | Thông báo lỗi tiếng Việt |
| `class-variance-authority` hoặc tương đương | Variant class helper |
| No Redux (state đủ nhỏ; dùng context/reducer hoặc Zustand) | |

---

## 15. Không thuộc phạm vi

- Không build PWA / offline-first (NEEDS_CONFIRMATION stakeholder).
- Không push notification.
- Không live chat built-in.
- Không A/B testing framework.
- Không affiliate/referral module.
