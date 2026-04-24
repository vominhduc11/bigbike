# MAIN_SITE_REQUIREMENTS.md â€” main-fe (Next.js public site)

YĂªu cáº§u chá»©c nÄƒng cho public storefront má»›i. **KhĂ´ng bao gá»“m thiáº¿t káº¿ giao diá»‡n.** Láº¥y nguá»“n tá»« [API_FLOW_MAP.md](API_FLOW_MAP.md), [BUSINESS_PROCESS.md](BUSINESS_PROCESS.md), [PAGE_INVENTORY.md](PAGE_INVENTORY.md).

---

## 1. Pháº¡m vi

main-fe phá»¥c vá»¥ toĂ n bá»™ traffic `bigbike.vn` vá»›i cĂ¡c yĂªu cáº§u cá»‘t lĂµi:

1. SEO-first (SSR/SSG/ISR, structured data, sitemap, canonical, OG).
2. URL identical vá»›i hiá»‡n táº¡i (xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md)).
3. Performance: LCP < 2.5s, CLS < 0.1, INP < 200ms á»Ÿ 75th percentile trĂªn mobile 4G.
4. KhĂ´ng public báº¥t ká»³ endpoint quáº£n trá»‹.
5. TĂ¡ch biá»‡t hoĂ n toĂ n khá»i admin-fe (deploy riĂªng, domain khĂ¡c náº¿u cáº§n).

---

## 2. Routes

| Route | Purpose | Data Needed | Rendering Strategy | SEO | Notes |
|---|---|---|---|---|---|
| `/` | Home | Featured products (3), featured carousel (5), categories `show_on_homepage=1`, 5 brands, 3 blog "Tin tá»©c" (cat 361), 3 review "Tráº£i nghiá»‡m" (cat 365), 5 videos, sliders, ACF `about_us`, `blog_content`, `content_bottom` | ISR 15 min + on-demand revalidate khi admin edit | Organization JSON-LD + WebSite SearchAction | Báº¯t buá»™c |
| `/shop/` (tÆ°Æ¡ng Ä‘Æ°Æ¡ng page_id=1) | Shop listing | Products paginated 24/page | ISR 5 min | Title rule brand/gender/price/color (BR-15) | NEEDS_CONFIRMATION slug thá»±c |
| `/shop/page/{n}/` | Shop page N | â€” | ISR | Canonical = page 1 náº¿u filter rá»—ng | |
| `/danh-muc-san-pham/{slug}/[page/{n}/]` | Product category | Products + ACF top_image/image_left/content_bottom | ISR 5 min | Title override + Breadcrumb JSON-LD | |
| `/pwb-brand/{slug}/[page/{n}/]` | Brand | Products + brand logo | ISR 5 min | Title + breadcrumb | |
| `/product/{slug}/` | Product detail | Product + variations + gallery + reviews + related (8 by primary category) + ACF rating/rating_count/content_bottom/videos | ISR 15 min | Product JSON-LD + Breadcrumb + AggregateRating | |
| `/tin-tuc/{slug}.html` | Blog post detail | Post + author + categories + tags + featured image + related | ISR 30 min | Article JSON-LD + Breadcrumb | |
| `/category/{slug}/[page/{n}/]` | Blog category | Posts list | ISR 10 min | Breadcrumb | |
| `/tag/{slug}/` | Blog tag | Posts list | ISR 30 min hoáº·c `noindex` | NEEDS_CONFIRMATION |
| `/gio-hang/` | Cart | WC cart session | SSR (dynamic) + CSR update | `noindex, nofollow` | |
| `/thanh-toan/` | Checkout | Cart + addresses + payment methods + shipping methods | SSR | `noindex, nofollow` | |
| `/thanh-toan/order-received/{id}` | Order received | Order by id + key | SSR | `noindex` | Emit GTM `purchase` |
| `/dang-nhap/` | Login form | â€” | SSG | `noindex` | Redirect náº¿u Ä‘Ă£ login |
| `/dang-ky/` | Register form | â€” | SSG | `noindex` | Redirect náº¿u Ä‘Ă£ login |
| `/quen-mat-khau/` | Lost + reset password | â€” | SSG + POST API | `noindex` | Supports `?token=` reset mode |
| `/tai-khoan/` | My Account dashboard | Current user | SSR | `noindex, nofollow` | Auth-gated |
| `/tai-khoan/orders/` | Order history | Orders of user | SSR | `noindex` | |
| `/tai-khoan/view-order/{id}/` | Order detail | Order | SSR | `noindex` | |
| `/tai-khoan/edit-account/` | Edit profile | User | SSR | `noindex` | |
| `/tai-khoan/edit-address/{billing\|shipping}/` | Edit address | Address | SSR | `noindex` | |
| `/tai-khoan/lost-password/?action=rp&key=...` | Reset password | â€” | SSR | `noindex` | |
| `/lien-he/` | Contact | Page content + ACF `contact_form`, `iframe_maps`, `note` | SSG | Meta | Form submit via API `/api/contact/submit` |
| `/gioi-thieu/` | About | Page content | SSG + ISR 30 min | Meta | |
| `/huong-dan/[...sub]/` | Guide | Page content + menu `guide` | SSG | Meta | Hierarchical |
| `/video/{slug}/` | Video detail | CPT `video` | SSG | Meta | NEEDS_CONFIRMATION URL |
| `/review/{slug}/` | Review detail | CPT `review` | SSG | Meta | NEEDS_CONFIRMATION URL |
| `/{page-slug}/` | Static page fallback (gioi-thieu, chinh-sach-*, etc.) | Page by slug | SSG + ISR | Meta | Catch-all cho 80 page |
| `/sitemap.xml` | Sitemap index | All published URLs | Static + revalidate | â€” | |
| `/sitemap-products.xml`, ... | Sub-sitemaps | | Static + revalidate | â€” | Chunk 500-1000 URL/file |
| `/robots.txt` | Robots | â€” | Static | â€” | |
| `/404` (via notFound) | 404 error | â€” | SSG | `noindex` | |
| `/search` (internal) hoáº·c `/?s={q}` | Search results | Products + posts matching | SSR | `noindex, canonical=/` | Search logic BR-10 |

---

## 3. Data source / API

main-fe láº¥y data tá»« backend/API (hoáº·c headless WordPress táº¡m thá»i â€” xem [PROJECT_OVERVIEW.md#7-phÆ°Æ¡ng-Ă¡n-táº¡m](PROJECT_OVERVIEW.md#7-phÆ°Æ¡ng-Ă¡n-táº¡m-phase-chuyá»ƒn-tiáº¿p)).

| Route | Endpoint API (Ä‘á» xuáº¥t) | Method | Auth |
|---|---|---|---|
| Home | `GET /api/public/home` | GET | Public |
| Shop list | `GET /api/public/products?category=&brand=&color=&gender=&min_price=&max_price=&page=&sort=` | GET | Public |
| Product detail | `GET /api/public/products/{slug}` | GET | Public |
| Variation lookup | `POST /api/public/products/{id}/match-variation` | POST | Public; thay tháº¿ API-08 |
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
| Lost password | `POST /api/v1/customer/auth/password/forgot` | POST | Guest |
| Reset password | `POST /api/v1/customer/auth/password/reset` | POST | Token |
| My profile | `GET /api/account/me` | GET | Auth |
| Update profile (thay API-03) | `PATCH /api/account/me` | PATCH | Auth + CSRF |
| My orders | `GET /api/account/orders` | GET | Auth |
| Order detail | `GET /api/account/orders/{id}` | GET | Auth + ownership |
| Contact submit | `POST /api/contact/submit` | POST | CSRF + CAPTCHA |
| Search | `GET /api/public/search?q=` | GET | Public |

Chi tiáº¿t API xem [CONTENT_MODEL.md](CONTENT_MODEL.md) cho shape.

---

## 4. Rendering strategy per route

| Chiáº¿n lÆ°á»£c | Ăp dá»¥ng | LĂ½ do |
|---|---|---|
| **SSG** (static generation build-time) | Static pages Ă­t Ä‘á»•i: `/gioi-thieu/`, `/lien-he/`, `/dang-nhap/`, `/dang-ky/`, `/quen-mat-khau/`, `/huong-dan/` | Ná»™i dung gáº§n nhÆ° khĂ´ng Ä‘á»•i |
| **ISR** (build at request + revalidate) | Home, shop, category, brand, product detail, blog | CĂ¢n báº±ng performance vs freshness. Revalidate 5â€“30 min. |
| **On-demand ISR** | Admin edit product/category/post â†’ gá»i `revalidateTag`/`revalidatePath` tá»« admin-fe | Äáº£m báº£o content fresh |
| **SSR** (má»—i request render server) | Cart, Checkout, Order received, My Account, Search results | CĂ³ per-user data hoáº·c query-string khĂ¡c nhau |
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
| Cart / Checkout / Account / Login / Register | **No** | â€” | â€” |
| Search | **No** | â€” | â€” |
| 404 | **No** | â€” | â€” |

Sitemap chunking: product sitemap split 500 URL/file â†’ ~44 file.

---

## 6. Error / empty / loading behaviour

| Route | Loading | Empty | Error |
|---|---|---|---|
| Home | Skeleton cĂ¡c section | Fallback text section | Server error page vá»›i liĂªn há»‡ |
| Shop / category / brand | Skeleton grid | "KhĂ´ng cĂ³ sáº£n pháº©m nĂ o phĂ¹ há»£p" | 500 page |
| Product detail | Skeleton gallery + info | 404 náº¿u slug khĂ´ng tá»“n táº¡i | 500 page |
| Cart | Skeleton rows | "Giá» hĂ ng trá»‘ng" + CTA "Tiáº¿p tá»¥c mua" | Toast error |
| Checkout | Skeleton form | Redirect `/gio-hang/` náº¿u empty cart | Inline field errors + toast |
| My Account | Skeleton | â€” | Redirect `/dang-nhap/` náº¿u 401 |
| Search | Skeleton | "KhĂ´ng tĂ¬m tháº¥y káº¿t quáº£ cho..." | â€” |
| Blog listing | Skeleton | "ChÆ°a cĂ³ bĂ i viáº¿t" | â€” |
| 404 | â€” | Static 404 page vá»›i menu + search | â€” |

Táº¥t cáº£ trang pháº£i cĂ³ **loading.tsx** (App Router) cho Suspense boundary, vĂ  **error.tsx** cho error boundary.

---

## 7. Search / filter requirement

TÆ°Æ¡ng á»©ng BR-10, BR-15. UI state pháº£i sync vá»›i URL query string Ä‘á»ƒ copy-paste share Ä‘Æ°á»£c:
- `?pwb-brand={slug}` â€” brand filter
- `?filter_color={slug}` â€” color filter
- `?filter_gender=nam|nu` â€” gender filter
- `?min_price=X&max_price=Y` â€” price range
- `?paged=N` â€” pagination
- `?orderby=price|popularity|date|...` â€” sort

Filter submission:
- Shop sidebar (devvn-woocommerce-price-filter) reimplement báº±ng client component.
- Multi-select cĂ³ debounce 300ms.
- Filter tÆ°Æ¡ng thĂ­ch vá»›i SSR: initial state parse tá»« URL trong server component.

Shop title override: xem [SEO_MIGRATION.md#2-mapping-meta-title](SEO_MIGRATION.md#2-mapping-meta-title).

---

## 8. Form requirement

Form nĂ o, cĂ¡ch submit, validation:

| Form | Submit | Validation | API |
|---|---|---|---|
| Login | POST `/api/auth/login` | username (required), password â‰¥ 6 | JSON response + set cookie |
| Register | POST `/api/auth/register` | phone = 10 digits, unique; email valid, unique; password â‰¥ 6; repassword == password; fullname required | + CAPTCHA |
| Lost password | POST `/api/auth/password/forgot` | username hoáº·c email | Silent thĂ nh cĂ´ng Ä‘á»ƒ trĂ¡nh enumeration |
| Reset password | POST `/api/auth/password/reset` | token + new password â‰¥ 6 | |
| Update profile | PATCH `/api/account/me` | optional old_password + new â‰¥ 6 + confirm | Require re-enter password cho sensitive change |
| Contact (CF7) | POST `/api/contact/submit` | fields theo form config | + CAPTCHA |
| Checkout billing/shipping | POST `/api/orders` | billing_phone = 10 digits, required billing + shipping fields | + CSRF + cart nonce |
| Quick Buy | POST `/api/orders/quick-buy` | name, phone (10 digits), address, product_id | + CAPTCHA + rate-limit (max 3/min/IP) |
| Coupon | POST `/api/cart/coupon` | code (required, uppercase) | Return cart totals |

Sá»­ dá»¥ng `react-hook-form` + Zod/Yup cho validation Ä‘á»“ng nháº¥t FE + API schema.

---

## 9. Performance requirement

| Metric | Target (mobile 4G) |
|---|---|
| LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| TTFB | < 600ms (home), < 800ms (product) |
| JS bundle initial route | < 180KB gzipped |
| Image: `next/image` máº·c Ä‘á»‹nh, lazy, AVIF/WebP auto |
| Font: subset Vietnamese, `display=swap` |

Techniques:
- Aggressive use of `Suspense` + `streaming`.
- Prefetch route on hover (Next.js built-in).
- CDN edge cache `Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400` cho HTML.
- Split `app/(marketing)`, `app/(shop)`, `app/(account)` route groups Ä‘á»ƒ bundle nhá».

---

## 10. Security consideration

- **CSRF token** cho má»i mutation (double-submit cookie hoáº·c SameSite=strict cookie + header).
- **Rate limiting** táº¡i reverse proxy (Nginx/Cloudflare) vĂ  táº¡i API (Redis).
- **CAPTCHA** (hCaptcha/Turnstile) cho register, quick-buy, contact, password-reset.
- **Session cookie** HttpOnly, SameSite=Lax (Strict cho account routes), Secure, path=/.
- **Content-Security-Policy** whitelist: self + GTM + CDN media + Google Maps + font sources.
- **Referrer-Policy** = `strict-origin-when-cross-origin`.
- **HSTS** enabled (sau khi confirm HTTPS cover toĂ n sub-domain).
- **XSS protection** báº±ng sanitize HTML server-side trÆ°á»›c khi lÆ°u, hoáº·c render `dangerouslySetInnerHTML` chá»‰ cho content Ä‘Ă£ sanitize.
- **SQL injection**: dĂ¹ng ORM + parameterized query.
- KhĂ´ng expose WordPress endpoint (xem [URL_REDIRECT_MAP.md](URL_REDIRECT_MAP.md) â€” block `/wp-admin`, `/wp-json`, `/wp-login.php`, `/xmlrpc.php`).

---

## 11. Phá»¥ thuá»™c cross-route / global

- Header + footer + mini-cart hiá»ƒn thá»‹ trĂªn má»i route.
- Mini-cart cĂ³ badge count, dropdown hiá»ƒn thá»‹ 3 item má»›i nháº¥t, báº¯t buá»™c update khi add/remove.
- Language switcher (náº¿u Polylang support >1 ngĂ´n ngá»¯): phase 2.
- Search icon header â†’ input inline.
- Floating "hotline" button (Zalo/Phone).

---

## 12. Analytics / tracking

- Google Tag Manager container (ID NEEDS_CONFIRMATION â€” tá»« `header.php` khĂ´ng cĂ³ inline GTM ID; cĂ³ thá»ƒ load qua plugin).
- Events:
  - `page_view` (má»—i route change)
  - `view_item` (product detail)
  - `view_item_list` (shop/category)
  - `select_item` (click product card)
  - `add_to_cart`, `remove_from_cart`
  - `view_cart`
  - `begin_checkout`, `add_shipping_info`, `add_payment_info`
  - `purchase` (order received)
- Facebook Pixel (NEEDS_CONFIRMATION tá»“n táº¡i â€” tháº¥y `facebook-domain-verification` trong header).

---

## 13. Accessibility

- DĂ¹ng semantic HTML.
- Nav `<nav aria-label=...>`.
- Form `<label>` liĂªn káº¿t vá»›i input.
- Button cĂ³ `aria-label` náº¿u chá»‰ chá»©a icon.
- Color contrast AA tá»‘i thiá»ƒu.
- Keyboard navigation Ä‘áº§y Ä‘á»§.

---

## 14. Dependency list tá»‘i thiá»ƒu

| Package | Má»¥c Ä‘Ă­ch |
|---|---|
| `next` â‰¥ 14 (App Router) | Framework |
| `react`, `react-dom` | Core |
| `tailwindcss` | Styling (khĂ´ng bĂ n design chi tiáº¿t) |
| `zod` | Validation |
| `react-hook-form` | Form |
| `@tanstack/react-query` (or native fetch cache) | Client-side data fetching cho cart |
| `next-intl` hoáº·c custom i18n | Äa ngĂ´n ngá»¯ Polylang |
| `js-cookie` hoáº·c native | Session cookie helper |
| `dompurify` (client) + sanitize server-side | HTML render an toĂ n |
| `zod-i18n-map` (optional) | ThĂ´ng bĂ¡o lá»—i tiáº¿ng Viá»‡t |
| `class-variance-authority` hoáº·c tÆ°Æ¡ng Ä‘Æ°Æ¡ng | Variant class helper |
| No Redux (state Ä‘á»§ nhá»; dĂ¹ng context/reducer hoáº·c Zustand) | |

---

## 15. KhĂ´ng thuá»™c pháº¡m vi

- KhĂ´ng build PWA / offline-first (NEEDS_CONFIRMATION stakeholder).
- KhĂ´ng push notification.
- KhĂ´ng live chat built-in.
- KhĂ´ng A/B testing framework.
- KhĂ´ng affiliate/referral module.

