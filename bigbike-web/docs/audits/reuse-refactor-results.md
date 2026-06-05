# Bigbike-web — Kết quả thực thi Refactor Tái sử dụng

> Đối chiếu với [`reuse-refactor-plan.md`](reuse-refactor-plan.md). Mỗi finding đã được **xác minh trên code thật** trước khi sửa (verify-before-fix). Đây là **refactor không đổi hành vi**: output render / markup / props công khai / response API / SEO giữ nguyên. Mọi thay đổi được một vòng review đối kháng (diff old↔new) xác nhận.
>
> Quy ước trạng thái: **Confirmed-Fixed** = vấn đề có thật, đã sửa. **Confirmed-Deferred** = vấn đề có thật nhưng hoãn (rủi ro đổi hành vi / phạm vi rộng / cần quyết định). **Not-confirmed** = mô tả audit sai hoặc đã được xử lý sẵn.

---

## 0. Baseline trước khi đụng (pre-existing — KHÔNG do refactor này, KHÔNG sửa)

| Check | Baseline | Sau refactor |
|---|---|---|
| `tsc --noEmit` | ✅ sạch | ✅ sạch |
| `vitest run` | ❌ 10 fail / 87 pass | ❌ 10 fail / 87 pass (y hệt — 0 fail mới) |
| `npm run lint` | ❌ 2 error + 15 warning | ❌ 2 error + 15 warning (y hệt — 0 mới) |
| `npm run build` | (n/a) | ✅ pass |

**10 test fail có sẵn** (drift code↔test, ngoài phạm vi): `format.test.ts` ×6 (fallback `"—"` vs kỳ vọng `"Liên hệ"`/`"Đang cập nhật"`), `auth.test.ts` ×2, `search-suggest-route.test.ts` ×2.
**2 lint error có sẵn:** `react-hooks/set-state-in-effect` tại `SearchToggle.tsx` (effect suggestions) và `useRecentSearches.ts`. Cả hai có trước refactor; **không sửa** (task riêng).

---

## 1. HIGH

| Finding | Trạng thái | Ghi chú |
|---|---|---|
| 6 carousel không có base chung → `Carousel`+`CarouselControls` | **Confirmed-Deferred** | Rủi ro cao: 3 cơ chế khác nhau (Swiper điều khiển + `syncViewportState`; Swiper module + pagination ngoài; 2 kiểu CSS-transform khác nhau) + 6 hệ class rời (bb-fp/bb-exp/bb-wp-related/swiper-*/bb-brand-mobile) gắn vào selector trong `globals.css` + 1 e2e contract (`experience-section.spec.ts`). Hợp nhất sẽ tái hiện từng cái trong 1 file — không phải đơn giản hoá, dễ vỡ visual. |
| Logic slides-per-view ×3 → `useResponsiveValue` | **Confirmed-Fixed** | Tạo `lib/hooks/useResponsiveValue.ts`; migrate `FeaturedProductsCarousel` + `PdpRelatedProductsCarousel` (initial value + resolve fn giữ nguyên → output y hệt). **Hoãn `HomeVideoCarousel`**: logic width nằm trong `syncViewportState` (kèm `canScroll` + clamp `selectedIndex` + wiring Swiper) — hook trả-giá-trị không tái hiện được. |
| matchMedia/resize/scroll lặp ~11 nơi → `useMediaQuery`+`useScrollPosition` | **Confirmed-Fixed (điều chỉnh)** | Thực tế chỉ ~2 listener thật; phần lớn "11" là đọc `scrollY` một lần cho `scrollTo` (không phải listener). Tạo `useMediaQueryChange(query,onMatch)` dedup 2 effect close-on-breakpoint **byte-identical** (`SearchToggle`+`MobileHeaderMenu`). **`useMediaQuery` value-hook không tạo** (sẽ fire `closePanel` lúc mount → đổi hành vi). **`useScrollPosition` Not-confirmed**: chỉ 1 listener (`StickyHeaderShell`, side-effect set DOM attribute), `ScrollToTopButton` không có scroll listener. |
| 3 cách format VND → 1 `formatVnd` | **Confirmed-Fixed** | `QuickBuyModal` đổi 5 chỗ `…₫` inline → `formatVnd` (hậu tố `" đ"` theo chỉ đạo; không test/snapshot phủ; không có rủi ro null). **`formatMoney` trong catalog.ts: Not-confirmed cho việc xoá** — nó cố tình không có ký hiệu vì SEO title tự thêm `" dong"`; xoá sẽ làm hỏng title thành `"… đ dong"`. Thay vào đó tách lõi chung `formatVndNumber`, cả `formatVnd` và `formatMoney` cùng dùng. |
| Logic giá sale/compare/discount ×3 → `derivePricing` | **Confirmed-Fixed (một phần)** | Tạo `lib/pricing.ts` `derivePricing` (trích nguyên văn từ `computePricing`). Dùng ở `ProductCard` + `ComparisonTable` (gate `>current` tại call-site để khớp `priceOf` cũ). **Hoãn `PricingPanel`** (sale-flag chỉ theo compare, input merge data/fallback, không tính discountPercent) và route API pricing (FP form `1-a/b` + trả 0-không-null) — ngữ nghĩa khác. |
| Map stock-state → label ×3 → `lib/stock.ts` | **Confirmed-Fixed (điều chỉnh)** | **Không tạo `lib/stock.ts`** — `format.ts` đã có `stockStateLabelWithT`. `ComparisonTable.stockLabelT` và phần label của `ProductCard.mapStockState` route về helper sẵn có; className map `bb-stock-*` giữ trong `ProductCard` (single-use). `StockStatus` để nguyên (không phải bản sao switch). |
| 5 route handler `app/api/products/[id]/*` → `backend-proxy` | **Confirmed-Fixed** | Tạo `lib/api/backend-proxy.ts` (`BACKEND`, `ProductRouteParams`, `proxyBackendJson`, `readBackendError`). 4 GET (pricing/snapshot/stock/variants) dùng `proxyBackendJson` + transform riêng (response body/status/header y hệt). **Route `reviews` giữ flow riêng** (404→200 EMPTY, 4xx-có-message, 503 fallback, POST validate) — chỉ tái dùng `BACKEND`/type/`readBackendError`. Test `snapshot-route` vẫn pass + build pass. |
| Parse param catalog ×3 → `catalog-params` | **Confirmed-Deferred** | Đúng là lặp, **behavior-preserving về nguyên tắc**, nhưng migration phạm vi rộng/rủi ro vừa: giá trị parse luồn qua `listProducts` args, `currentFilters`, `baseHref`, và `collectErrors` (thứ tự tham số là quan sát được); `san-pham` còn có param `category` riêng. Đã đặc tả parser common-core cho follow-up; hoãn để tránh rewire diện rộng dễ sai trong đợt này. |
| Render tail archive ×3 → `ProductArchiveResults` | **Confirmed-Fixed** | Tạo `components/catalog/ProductArchiveResults.tsx`: grid + `PaginationNav` dùng chung; phần khác nhau (empty i18n-vs-literal, error `<p>`-vs-`<ErrorState>`, mô tả category, baseHref) truyền qua props → output 3 trang không đổi. |
| Helper WP ×2 (tin-tuc) → `wp-media` | **Confirmed-Fixed** | Tạo `lib/utils/wp-media.ts` (`resolveWpUploadUrl`, `makeSlugThumbnailFallback` — byte-identical). `stripHtml` → `text.ts` `stripHtmlTags`; `textOrFallback` → `safeText` sẵn có (tương đương). `makeExcerpt`/date helpers (khác nhau) giữ tại trang. |
| Flow CMS tĩnh ×~8 → `loadStaticPage`+`StaticPageShell` | **Confirmed-Deferred** | Chỉ 3/8 trang là hero+richtext thuần (`lien-he`/`gioi-thieu`/`GuidePage` bespoke). Slug resolution (`isValidSlug`, `POLICY_SLUG_MAP`) phải ở lại từng trang nếu không đổi hành vi; class grid/gap khác nhau. Lợi ích/rủi ro biên — hoãn. |
| `ProductCard` 378 dòng → tách subcomponent/variant | **Confirmed-Deferred** | Không nằm trong danh sách Phase 1–5 (mục 4). Đã tách `derivePricing` (xem trên); việc tách `ProductCardFeatured/Related/Archive` + `ProductCardImage` là refactor nội bộ lớn, để task riêng. |
| `ShopInfoDrawer`/`MobileHeaderMenu`: drawer→`Sheet`, `MenuIcon`→icons, hours/phones→`shop.ts` | **Confirmed-Fixed (một phần)** | `MenuIcon` → `icons.tsx` (Phase 3); `parseShopHours`/`parsePhones` → `shop.ts` (Phase 1). **Hoãn migrate drawer sang `Sheet`**: viết lại overlay/slide/focus của 2 drawer bespoke là rủi ro hành vi cao, ngoài phạm vi refactor an toàn. |

---

## 2. MEDIUM

| Finding | Trạng thái | Ghi chú |
|---|---|---|
| `DEFAULT_SORT`/`DEFAULT_PAGE_SIZE`/dải giá ×3 → `lib/constants/catalog.ts` | **Confirmed-Fixed** | `DEFAULT_PRODUCT_SORT`/`DEFAULT_PRODUCT_PAGE_SIZE`/`PRICE_PARAM_MAX`. Import alias để giữ tham chiếu in-file. **`DEFAULT_WP_ORDERBY` Not-confirmed** (đã ở `catalog-sort.ts`, các trang đã import — không lặp). `PRICE_FALLBACK`/`COLOR_FALLBACK` để nguyên (single-site, có label tiếng Việt + "VND"). |
| Guard `typeof window` + try/catch JSON quanh localStorage → `storage.ts`+`useLocalStorage` | **Confirmed-Fixed (một phần)** | Tạo `lib/utils/storage.ts` `safeStorage`; migrate `compare-storage`/`recently-viewed`/`useRecentSearches` (giữ cap slice + filter element + SSR guard). **`useLocalStorage` Confirmed-Deferred** (không consumer nào hưởng lợi mà không đổi hành vi). 3/7 file audit cite sai (`compare-context`, `so-sanh`, `client-api` chỉ có comment). `PurchaseEvent` (sessionStorage, chuỗi `"1"`) bỏ qua. |
| `tel:` href lặp ×5 (3 regex) → `contact.ts` | **Confirmed-Fixed (điều chỉnh)** | Thêm `telHref`/`zaloHref` vào `format.ts` (không tạo `contact.ts` riêng — gom với phone-utils sẵn có). Migrate 5 site `/[^\d+]/g` (SiteFooter, ProductContactCta, FloatingChat, lien-he, gioi-thieu — byte-identical). **Hoãn `ShopInfoDrawer`+`MobileHeaderMenu`** (regex `/[\s.]/g` khác → có thể đổi output với hotline chứa ký tự lạ). `zaloHref` chỉ 1 caller thật (ProductContactCta). |
| `defaultHours`/`phones` block lặp verbatim → `shop.ts` | **Confirmed-Fixed** | `lib/utils/shop.ts` `parseShopHours`/`parsePhones` (byte-identical; `t()` assembly giữ trong component). |
| `toLegacyWpMediaUrl` lặp → `format.ts` | **Confirmed-Fixed** | Thực tế 3 file (BrandCarousel, ProductCard, **app/page.tsx** — audit cite 2). Dùng `PUBLIC_BASE_URL` sẵn có (output y hệt). |
| `StarRow` vs `RatingStars` → generalize | **Confirmed-Deferred** | Không trong danh sách Phase 1–5; generalize `RatingStars` thêm mode svg/outline sẽ đổi render — task riêng. |
| Shell nút icon overlay ×2 → `CardIconButton` | **Confirmed-Fixed** | `components/shared/CardIconButton.tsx`. Cursor giữ chính xác per-site qua prop `className` (Wishlist có `cursor-pointer`, Compare không); `disabled`/`aria-pressed` điều kiện → attribute set mỗi site không đổi. |
| Control −/value/+ inline ×2 → `QuantityStepper` | **Confirmed-Deferred** | Loại "route về primitive sẵn có", không trong danh sách Phase 1–5; chưa thực hiện trong đợt này. |
| Block field RHF ×9 → `AuthField` | **Confirmed-Fixed (một phần)** | `components/ui/AuthField.tsx` — cờ `describeError` tái hiện cả Shape A (login/reset, có aria-wiring) và Shape B (register, không) → 9 field không đổi attribute. **Hoãn field `forgot-login`** (sr-only label, bare div, không dấu `*`, error `mt-2` — outlier). |
| Alert `errors.root` ×3 → `FormRootError` | **Confirmed-Fixed** | `components/ui/FormRootError.tsx` (markup y hệt; `RootError` local của ForgotPasswordFlow bị xoá). |
| Banner success/error ×7 → `FormNotice`; `LEGACY_LABEL`+`ReqMark` | **Confirmed-Fixed (một phần)** | `components/ui/FormNotice.tsx` (tone + className passthrough; `tailwind-merge` xử lý override padding doi-tra; render-set y hệt). **`AccountField` Not-confirmed** (đơn vị "label+ReqMark+input+error" không tồn tại — không có per-field error). `ReqMark`/`LEGACY_LABEL` để nguyên (trivial; overlap với primitive sẵn có). |
| Scaffold bảng order/invoice ×3 → `AccountTable`+`AccountError` | **Confirmed-Deferred** | `AccountTable` kiểu columns/rows là leaky abstraction (chỉ 2/3 bảng share wrapper ~2 dòng; bảng returns khác hẳn). `AccountError` (1 dòng `<p text-brand>`) overlap `FormNotice`/`ErrorState` + cần className per-site. Giá trị biên. |
| 2 paginator WP → `WpPagination`+`buildWpPageWindow` | **Resolved-2026-06-05** | (Hoãn ban đầu vì 2 thuật toán window khác nhau → đổi hành vi.) Đã giải quyết bằng cách hợp nhất về component chuẩn dự án `PaginationNav` (KHÔNG tạo `WpPagination` mới): `tim-kiem` + `tin-tuc` dùng `variant="archive"`, `tai-khoan/don-hang` dùng `variant="default"` (đồng thời chuyển từ state nội bộ sang URL `?page=`). User explicitly duyệt đồng bộ; chấp nhận thay đổi nhỏ ở dãy số trang hiển thị (window của `PaginationNav` thắng). Xoá `SearchPagination`/`WpPagination`/`buildWpPageItems` + 2 i18n key orphan `Account.orders.previous|next`. |
| `generateMetadata` archive noIndex ×3 → `buildCatalogMetadata` | **Confirmed-Deferred** | SEO-sensitive: `san-pham` có term `category` thừa; title/canonical/ogImage khác per-site; cần parameterize nặng; bản phẳng sẽ lật noindex/canonical (SEO regression). |
| Metadata slug-detail ×5 → `buildSlugDetailMetadata` | **Confirmed-Deferred** | Mỗi trang có canonical builder + i18n key + ogImage/ogType riêng; `danh-muc`/`brands` còn compose với catalog metadata. Cần parameterize toàn bộ; hoãn để tránh SEO regression. |
| `fetch()` trực tiếp ×4 → route qua `client-api` | **Not-confirmed** | Tiền đề audit sai: 4 component gọi **route BFF same-origin** (`/api/...`) chứ không phải backend mà `clientRequest` nhắm (`API_BASE_URL`). Route qua `clientRequest` sẽ đổi host, **thêm credentials/CSRF**, mất `AbortSignal`, đổi error parsing → **đổi hành vi**. `MobileCartSheet` không hề có `fetch` trực tiếp (đã dùng query hooks). |
| `toGtmCartItems` lặp verbatim ×3 → `lib/analytics.ts` | **Confirmed-Fixed** | Thêm `toGtmCartItems(items)` vào `analytics.ts`; migrate `thanh-toan`+`gio-hang` (payload y hệt). **`don-hang/xac-nhan` không đụng** (shape khác: không `currency`, fallback id khác, type `OrderLineItem`). |

---

## 3. LOW

| Finding | Trạng thái | Ghi chú |
|---|---|---|
| `stripHtml`/`htmlToPlainText` lặp → `lib/utils/html.ts` | **Confirmed-Fixed (điều chỉnh)** | Đặt `stripHtmlToText`+`stripHtmlTags` vào **`lib/utils/text.ts`** (không phải `html.ts`) vì `html.ts` import `isomorphic-dompurify`; import vào client component (`ArticleCard`) sẽ bundle DOMPurify (~20KB) — regression. Migrate `app/page.tsx`+`ArticleCard` (`stripHtmlToText`), 2 trang `tin-tuc` (`stripHtmlTags`). 3 site phân kỳ (regex/whitespace/slice khác) để nguyên. |
| SVG inline → `lucide-react` hoặc `icons.tsx` | **Confirmed-Fixed (một phần)** | Gom 2 bộ **byte-identical** vào `components/ui/icons.tsx`: `MenuIcon` (×2) + `CarouselArrow` (×2). **Không đổi sang lucide** (đổi path = đổi visual). Chevron up/down & close-X gần-giống (khác size/strokeWidth) để nguyên. |
| Radio-card thanh toán → `RadioCard` | **Not-confirmed** | Single-use thật (shipping trong QuickBuyModal là read-only auto-computed, không phải card chọn). 3 ứng viên dùng 3 hệ markup khác nhau (raw input / shadcn RadioGroup / legacy `wc_*`). |
| `uuid4` inline → `lib/utils/uuid.ts` | **Confirmed-Fixed (điều chỉnh)** | **Không tạo `uuid.ts`** — đã có `generateId()` trong `lib/utils.ts` (crypto.randomUUID + fallback), đang dùng cho cùng mục đích idempotency-key ở `thanh-toan`. QuickBuyModal đổi 2 call site sang `generateId()`. |
| Empty-cart block → `EmptyState` | **Confirmed-Deferred** | Loại "route về primitive", không trong danh sách Phase 1–5; chưa thực hiện. |
| `readContactSettings` → `settings.ts` | **Confirmed-Deferred** | Không trong danh sách Phase 1–5; Low; chưa thực hiện. |
| Lỗi province/district → `FormField`/`FormMessage` | **Confirmed-Deferred** | Loại "route về primitive", không trong danh sách Phase 1–5; chưa thực hiện. |

**"Đã tốt, không cần đụng"**: tôn trọng — không refactor `Skeletons`/`QuantityStepper`/`EmptyState`/`ErrorState`/`ContactInfoList`/shadcn primitive/`AccountShell`/`page-hero.ts`/`loading.tsx`.

---

## 4. File đã tạo / sửa

### Mới tạo (15)
| Phase | File |
|---|---|
| 1 | `lib/constants/catalog.ts`, `lib/pricing.ts`, `lib/utils/shop.ts`, `lib/utils/storage.ts`, `lib/utils/wp-media.ts`, `lib/utils/text.ts` |
| 2 | `lib/hooks/useResponsiveValue.ts`, `lib/hooks/useMediaQueryChange.ts` |
| 3 | `components/ui/FormRootError.tsx`, `components/ui/FormNotice.tsx`, `components/ui/AuthField.tsx`, `components/ui/icons.tsx`, `components/shared/CardIconButton.tsx` |
| 4 | `components/catalog/ProductArchiveResults.tsx` |
| 5 | `lib/api/backend-proxy.ts` |

### Augment / migrate (đã xoá code trùng)
- **Phase 1:** `lib/utils/format.ts` (+`formatVndNumber`/`toLegacyWpMediaUrl`/`telHref`/`zaloHref`), `lib/utils/catalog.ts`, `lib/analytics.ts`; sửa import-site: `ProductCard`, `ComparisonTable`, `QuickBuyModal`, `BrandCarousel`, `app/page.tsx`, `ArticleCard`, `SiteFooter`, `ProductContactCta`, `FloatingChat`, `ShopInfoDrawer`, `MobileHeaderMenu`, `app/lien-he`, `app/gioi-thieu`, `app/san-pham`, `app/danh-muc-san-pham/[slug]`, `app/brands/[slug]`, `app/thanh-toan`, `app/gio-hang`, `app/tin-tuc`, `app/tin-tuc/[slug]`, `lib/compare-storage.ts`, `lib/recently-viewed.ts`, `lib/hooks/useRecentSearches.ts`.
- **Phase 2:** `FeaturedProductsCarousel`, `PdpRelatedProductsCarousel`, `SearchToggle`, `MobileHeaderMenu`.
- **Phase 3:** `ShopInfoDrawer`, `MobileHeaderMenu`, `ProductGallery`, `PdpRelatedProductsCarousel`, `LoginForm`, `RegisterForm`, `ForgotPasswordFlow`, `edit-account`, `edit-address/[type]`, `doi-tra`, `WishlistButton`, `CompareButton`.
- **Phase 4:** `app/san-pham`, `app/danh-muc-san-pham/[slug]`, `app/brands/[slug]`.
- **Phase 5:** 5 route `app/api/products/[id]/{pricing,snapshot,stock,variants,reviews}/route.ts`.

### Commits (nhánh `refactor/web-reuse-dedup`)
```
37ea7ef6  Phase 1 — shared utils/constants
345bec55  Phase 2 — responsive-value + media-query hooks
fc0c5aaf  Phase 3 — shared UI primitives
068ba2f0  Phase 4 — ProductArchiveResults
f3f4a766  Phase 5 — backend-proxy
```

---

## 5. Lệnh kiểm tra đã chạy (sau mỗi phase + cuối)

| Lệnh | Kết quả cuối |
|---|---|
| `npx tsc --noEmit` (qua `./node_modules/.bin/tsc`) | ✅ sạch (0 error) |
| `npm run lint` (gồm `check:no-runtime-business-data` + eslint) | ✅ = baseline (2 error + 15 warning có sẵn, **0 mới**); guard business-data pass |
| `npx vitest run` | ✅ = baseline (87 pass / 10 fail có sẵn, **0 fail mới**) |
| `npm run build` (Phase 4 + 5) | ✅ pass |

---

## 6. Quyết định cần biết

- **Ký hiệu tiền tệ:** giữ mặc định `" đ"` (theo chỉ đạo). `QuickBuyModal` đổi `₫` → `formatVnd` (`" đ"`) — **không** có test/snapshot phủ output này, nên không cần dừng hỏi; đây đúng là mục tiêu chuẩn hoá. `formatMoney` (SEO) **không** đổi.
- **Lệch code↔test có sẵn** (10 fail) và **2 lint error có sẵn**: là drift/issue riêng, **cố ý không sửa** trong refactor này (đúng quy tắc "không tự fix cái đã có / ngoài phạm vi"). Nên xử lý ở task riêng.
- **`app/lien-he/page.tsx`, `app/globals.css`, `next-env.d.ts`** có thay đổi không-thuộc-refactor trong working tree từ trước (typography/responsive đang dở + file auto-gen) — **không** đưa vào các commit phase (trừ phần `telHref` của lien-he ở Phase 1).
