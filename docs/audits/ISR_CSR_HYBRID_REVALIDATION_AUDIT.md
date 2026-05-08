# ISR On-Demand + CSR Hybrid Revalidation Audit

**Dự án:** bigbike-web (Next.js 16.2.4, App Router)
**Ngày audit:** 2026-05-08
**Auditor:** Claude Senior Next.js Architect + SEO Performance Engineer
**Phạm vi:** ISR cache correctness, on-demand revalidation pipeline, CSR hybrid safety, reload-after-update guarantee

---

## 1. Next.js Version / Architecture

| Item | Giá trị |
|---|---|
| Next.js | 16.2.4 |
| React | 19.2.4 |
| Router | App Router |
| Output | `standalone` |
| TanStack Query | v5 |
| `trailingSlash` | `true` |
| `experimental.staleTimes` | `{ static: 180, dynamic: 30 }` (client router cache) |
| `revalidate` global | KHÔNG — mỗi page tự khai |
| Server Components | Có — toàn bộ page.tsx là RSC |
| Client Components | Có — `PurchaseSectionClient`, `ReviewsSection`, cart, auth |
| ISR mechanism | `export const revalidate = 3600` + `revalidateTag` on-demand |

Evidence: `bigbike-web/next.config.ts:155-165`, `bigbike-web/package.json`

---

## 2. ISR Cache Policy — Bảng page.tsx

| Route | File | SEO critical | Server-rendered | `revalidate` | Fetch tags | Dynamic data | Nhận xét |
|---|---|---|---|---|---|---|---|
| `/` | `app/page.tsx` | YES | YES | 3600 | products, articles, brands, sliders, home-videos, settings, categories | Có (settings từ DB) | ISR đúng |
| `/product/[slug]` | `app/product/[slug]/page.tsx` | YES | YES | 3600 | products, product:{slug} | Pricing/stock CSR | ISR đúng, CSR hybrid đúng |
| `/tin-tuc/[slug]` | `app/tin-tuc/[slug]/page.tsx` | YES | YES | 3600 | articles, article:{slug} | Không | ISR đúng |
| `/danh-muc-san-pham/[slug]` | `app/danh-muc-san-pham/[slug]/page.tsx` | YES | YES | 3600 | categories, category:{slug}, products | Không | ISR đúng |
| `/brands/[slug]` | `app/brands/[slug]/page.tsx` | YES | YES | 3600 | brands, brand:{slug}, products | Không | ISR đúng |
| `/san-pham` | `app/san-pham/page.tsx` | YES | YES | **KHÔNG** | products, brands (tagged ISR fetches) | searchParams → fully dynamic | Mỗi URL filter combo là new request, không ISR-cached per-URL. Chấp nhận được nhưng không cache-efficient |
| `/tin-tuc` | `app/tin-tuc/page.tsx` | YES | YES | **KHÔNG** | articles | searchParams → fully dynamic | Như trên |
| `/brands` | `app/brands/page.tsx` | MED | YES | **KHÔNG** | brands | searchParams → fully dynamic | Như trên |
| `/danh-muc-san-pham` | `app/danh-muc-san-pham/page.tsx` | MED | YES | **KHÔNG** | categories | Không | Full static, OK nếu category update purge tag |
| `/[slug]` (static pages) | `app/[slug]/page.tsx` | MED | YES | **KHÔNG** | pages, page:{slug} | Không | Full static, on-demand revalidation via tag OK |
| `/chinh-sach/[slug]` | `app/chinh-sach/[slug]/page.tsx` | MED | YES | **KHÔNG** | pages, page:{slug} | Không | Full static, OK |
| `/gioi-thieu` | `app/gioi-thieu/page.tsx` | LOW | YES | **KHÔNG** | pages, page:{slug}? | Không | OK |
| `/gio-hang` | `app/gio-hang/page.tsx` | NO | Client-only | — | — | Cart = localStorage | Đúng |
| `/thanh-toan` | `app/thanh-toan/page.tsx` | NO | Client-only | — | — | Checkout | Đúng |
| `/dang-nhap` | `app/dang-nhap/page.tsx` | NO | Client-only | — | — | Auth | Đúng |
| `/tai-khoan/*` | — | NO | Client-only | — | — | User-specific | Đúng |
| `/tim-kiem` | `app/tim-kiem/page.tsx` | NO | Client-only | — | — | `cache: "no-store"` | Đúng |

**Kết luận mục 2:** Các page SEO critical đều đặt `revalidate = 3600` hoặc full-static với on-demand tag revalidation. Listing pages với searchParams là fully dynamic — đây là giới hạn bình thường của Next.js (không thể ISR-cache từng filter combination).

---

## 3. Public API Cache Tags — `bigbike-web/lib/api/public-api.ts`

Hàm trung tâm `requestJson<T>()` (line 101–122): `revalidate === 0` → `cache: "no-store"`, ngược lại → `next: { revalidate, tags }`.

| Function | Backend endpoint | TTL (s) | Tags | Loại dữ liệu | Đánh giá |
|---|---|---|---|---|---|
| `listProducts` | `/api/v1/products` | 3600 | `["products"]` | Listing | Đúng |
| `getProductBySlug` | `/api/v1/products/{slug}` | 3600 | `["products","product:{slug}"]` | PDP static | Đúng |
| `listCategories` | `/api/v1/categories` | 3600 | `["categories"]` | Listing | Đúng |
| `getCategoryBySlug` | `/api/v1/categories/{slug}` | 3600 | `["categories","category:{slug}"]` | Category PDP | Đúng |
| `listBrands` | `/api/v1/brands` | 3600 | `["brands"]` | Listing | Đúng |
| `getBrandBySlug` | `/api/v1/brands/{slug}` | 3600 | `["brands","brand:{slug}"]` | Brand PDP | Đúng |
| `listArticles` | `/api/v1/articles` | 3600 | `["articles"]` | Listing | Đúng |
| `getArticleBySlug` | `/api/v1/articles/{slug}` | 3600 | `["articles","article:{slug}"]` | Article PDP | Đúng |
| `listPages` | `/api/v1/pages` | 3600 | `["pages"]` | Pages list | Đúng |
| `getPageBySlug` | `/api/v1/pages/{slug}` | 3600 | `["pages","page:{slug}"]` | Static page | Đúng |
| `getPublicMenu` | `/api/v1/menus/{location}` | 3600 | **`["menus"]`** | Nav/header/footer | **Xem BUG-001** |
| `listPublicSettings` | `/api/v1/settings/public` | 3600 | `["settings"]` | Site config | Đúng |
| `listHomeSliders` | `/api/v1/sliders?location=home` | 3600 | `["sliders"]` | Homepage | Đúng |
| `listHomeVideos` | `/api/v1/home-videos` | 3600 | `["home-videos"]` | Homepage | Đúng |
| `getOrderLookup` | `/api/v1/orders/lookup` | 0 | none | User-specific | Đúng (`no-store`) |
| `search` | `/api/v1/search` | 0 | none | User query | Đúng (`no-store`) |

**Tag granularity đánh giá:**

- Update 1 product có purge đúng PDP không? **CÓ** — `product:{slug}` + `products` đều được gửi
- Update 1 product có purge product listing/home featured/category/brand không? **CÓ** — tag `products` cover tất cả
- Đổi slug product có purge cả slug cũ và slug mới không? **CÓ** — `AdminCatalogMutationService.java:1385` gửi cả `previousSlug` và `currentSlug`
- Update category có ảnh hưởng product listing không? **CÓ** — tag `products` được thêm khi category thay đổi
- Update category có ảnh hưởng menu/nav không? **KHÔNG** — **BUG-001** (xem mục 5)
- Update menu header/footer có reload dữ liệu mới không? **CÓ** — `AdminMenuService` gửi `"menus"` khớp với tag fetch
- Update setting/slider có làm homepage reload dữ liệu mới không? **CÓ**

---

## 4. On-Demand ISR Endpoint — `bigbike-web/app/api/revalidate/route.ts`

### Code đầy đủ (50 dòng):

```typescript
export const runtime = "nodejs";  // line 4

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? process.env.WEB_REVALIDATE_SECRET;  // line 6

function parseTags(body): string[] {  // line 8
  // dedup + trim + filter empty + filter >256 chars
}

export async function POST(request: NextRequest) {  // line 23
  const secret = request.headers.get("x-revalidate-secret");
  if (!REVALIDATE_SECRET || secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });  // fail-fast khi secret rỗng
  }
  // parse JSON, validate tags
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 });  // line 45 — Next.js 16.x API đúng
  }
  return NextResponse.json({ revalidated: true, tags });
}
```

### Checklist bảo mật:

| Item | Trạng thái | Chi tiết |
|---|---|---|
| Secret guard | PASS | Header `x-revalidate-secret` được check (line 24-27) |
| Fail-fast khi secret rỗng | PASS | `!REVALIDATE_SECRET` → 401 (line 25) — production không secret = reject tất cả |
| JSON validation | PASS | try/catch parse JSON (line 30-34) |
| Tag validation | PASS | `parseTags()` filter null/empty/length>256 |
| Tag dedup | PASS | `new Set(...)` trong `parseTags()` (line 13-14) |
| Dual env var | PASS | Chấp nhận cả `REVALIDATE_SECRET` và `WEB_REVALIDATE_SECRET` (backward compat) |
| `runtime = "nodejs"` | PASS | Required cho `revalidateTag` (line 4) |
| `revalidateTag` API | PASS | `revalidateTag(tag, { expire: 0 })` — đúng Next.js 16.x API (`CacheLifeConfig = { expire?: number }`) |
| Allowlist tag | KHÔNG | Tag không bị validate, bất kỳ tag nào hợp lệ đều được revalidate — low risk vì secret guard |
| Body size limit | KHÔNG | Không giới hạn số lượng tag per request — P3 |
| Logging | KHÔNG | Không có application-level logging — chỉ có response trả về |
| Rate limiting | KHÔNG | P2 — không critical nếu secret đủ mạnh |
| Test | CÓ | WebRevalidationServiceTest.java (backend unit test), không có frontend test |

### Kết luận endpoint:

- **An toàn production không?** CÓ, với điều kiện `WEB_REVALIDATE_SECRET` được set trên production. Nếu thiếu secret, endpoint tự fail-safe (401 tất cả).
- **Reload có cập nhật data mới không?** CÓ, nếu backend gọi revalidate thành công. `revalidateTag(tag, { expire: 0 })` invalidates cache entry, request tiếp theo sẽ re-fetch từ backend.
- **Nếu backend gọi thất bại thì sao?** Cache giữ nguyên đến khi hết TTL 3600s. Không có retry, không có durable fallback — **xem BUG-003**.

---

## 5. Backend Revalidation Pipeline

### WebRevalidationService.java (`bigbike-backend/.../service/web/WebRevalidationService.java`)

| Property | Giá trị | Đánh giá |
|---|---|---|
| Triggered | Sau `afterCommit()` via `TransactionSynchronizationManager` (line 51-58) | ĐÚNG — không purge cache nếu transaction rollback |
| Dispatch mode | `CompletableFuture.runAsync()` (line 65) — non-blocking async | ĐÚNG |
| Connect timeout | 3s (line 36) | OK |
| Read timeout | 5s (line 38) | OK |
| Dedup | `LinkedHashSet` (line 44-48) | ĐÚNG |
| Retry | KHÔNG (line 75: chỉ `log.warn`) | **BUG-003** |
| Durable outbox | KHÔNG | **BUG-003** |
| Enabled check | `revalidateUrl.isBlank() || secret.isBlank()` → skip (line 33) | ĐÚNG — graceful disable |

### Bảng mutation → tags gửi đi:

| Backend mutation | File | Tags gửi đi | Sau commit? | Có retry? | Đánh giá |
|---|---|---|---|---|---|
| `createProduct` | AdminCatalogMutationService:116 | `products`, `product:{slug}` | YES | KHÔNG | Đúng tag |
| `updateProduct` | AdminCatalogMutationService:142 | `products`, `product:{prevSlug}`, `product:{newSlug}` | YES | KHÔNG | Đúng — cover slug rename |
| `updateProductPublishStatus` | AdminCatalogMutationService:172 | `products`, `product:{slug}` | YES | KHÔNG | Đúng |
| `softDeleteProduct` | AdminCatalogMutationService:205 | `products`, `product:{slug}` | YES | KHÔNG | Đúng |
| `restoreProduct` | AdminCatalogMutationService:237 | `products`, `product:{slug}` | YES | KHÔNG | Đúng |
| `createCategory` | AdminCatalogMutationService:265 | `categories`, `category:{slug}`, `products`, **`menu:primary`** | YES | KHÔNG | **BUG-001** |
| `updateCategory` | AdminCatalogMutationService:315 | `categories`, `category:{prevSlug}`, `category:{newSlug}`, `products`, **`menu:primary`** | YES | KHÔNG | **BUG-001** |
| `softDeleteCategory` | AdminCatalogMutationService:288 | `categories`, `category:{slug}`, `products`, **`menu:primary`** | YES | KHÔNG | **BUG-001** |
| `createBrand` | AdminCatalogMutationService:337 | `brands`, `brand:{slug}`, `products` | YES | KHÔNG | Đúng |
| `updateBrand` | AdminCatalogMutationService:359 | `brands`, `brand:{prevSlug}`, `brand:{newSlug}`, `products` | YES | KHÔNG | Đúng |
| `deleteBrand` | AdminCatalogMutationService:378 | `brands`, `brand:{slug}`, `products` | YES | KHÔNG | Đúng |
| `createArticle` | AdminContentMutationService | `articles`, `article:{slug}` | YES | KHÔNG | Đúng |
| `updateArticle` | AdminContentMutationService:706 | `articles`, `article:{prevSlug}`, `article:{newSlug}` | YES | KHÔNG | Đúng |
| `deleteArticle` (→ARCHIVED) | AdminContentMutationService | `articles`, `article:{slug}` | YES | KHÔNG | Đúng |
| `createPage` / `updatePage` / `deletePage` | AdminContentMutationService | `pages`, `page:{slug}` | YES | KHÔNG | Đúng |
| `updateSetting` | AdminSettingsService:154 | `settings` | YES | KHÔNG | Đúng |
| `batchUpdateSettings` | AdminSettingsService:217 | `settings` | YES | KHÔNG | Đúng |
| Slider CRUD/reorder | AdminSliderService:77,127,172,235 | `sliders` | YES | KHÔNG | Đúng |
| HomeVideo CRUD/reorder | AdminHomeVideoService:83,121,132,173 | `home-videos` | YES | KHÔNG | Đúng |
| Menu/MenuItem CRUD/reorder | AdminMenuService:131,161,179,222,288,316,375 | `menus` | YES | KHÔNG | Đúng |
| Inventory adjustStock | AdminInventoryService:271 | `product:{slug}`, `products` | YES | KHÔNG | Đúng |
| Inventory adjustProductStock | AdminInventoryService:342 | `product:{slug}`, `products` | YES | KHÔNG | Đúng |
| Review status change/delete | AdminReviewService:192 | `product:{slug}`, `products` | YES | KHÔNG | Đúng |
| Redirect CRUD | AdminRedirectService:155,209,221 | `redirects` | YES | KHÔNG | Dead tag — xem BUG-004 |

### Mutations KHÔNG gọi revalidate (và lý do):

| Mutation | Gọi revalidate? | Đánh giá |
|---|---|---|
| `CheckoutService` | KHÔNG | Đúng — checkout không ảnh hưởng public ISR |
| `AdminCouponService` | KHÔNG | Đúng — coupon không render trong ISR public pages |
| `AdminCustomerService` | KHÔNG | Đúng — user data không ISR public |
| `AdminMediaService` | KHÔNG | Sai một phần — media URL thay đổi ảnh hưởng PDP nếu admin replace image. Nhưng image URL được lưu trong product entity, nên `updateProduct` revalidate sẽ cover |
| `AdminRedirectService` | CÓ nhưng tag `redirects` là dead | Xem BUG-004 |

---

## 6. CSR Hybrid Correctness

### API proxy routes (`bigbike-web/app/api/products/[id]/`)

| Route | `dynamic` | `cache: no-store` | Proxies to | Đánh giá |
|---|---|---|---|---|
| `/snapshot/route.ts` | `force-dynamic` | YES | `/api/v1/products/{idOrSlug}/snapshot` | ĐÚNG — backend accepts slug + ID |
| `/pricing/route.ts` | `force-dynamic` | YES | `/api/v1/products/{id}` | Có vẻ dead code (xem bên dưới) |
| `/stock/route.ts` | `force-dynamic` | YES | `/api/v1/products/{id}` | Có vẻ dead code |
| `/variants/route.ts` | `force-dynamic` | YES | `/api/v1/products/{id}` | Có vẻ dead code |
| `/reviews/route.ts` | **KHÔNG** | YES (response header) | `/api/v1/products/{id}/reviews` | **BUG-005** |
| `/api/search-suggest/route.ts` | **KHÔNG** | Không dùng no-store | `/api/v1/search` | **BUG-006** |

### PurchaseSectionClient — CSR dynamic fetch

```typescript
// bigbike-web/components/catalog/PurchaseSectionClient.tsx:108-118
const { data: snapshot, isLoading: snapshotLoading } = useQuery<ProductSnapshot>({
  queryKey: ["product-snapshot", productId],
  queryFn: async () => {
    const res = await fetch(`/api/products/${productSlug}/snapshot/`);  // line 112 — dùng slug, đúng vì backend accept slug
    if (!res.ok) throw new Error("snapshot");
    return res.json() as Promise<ProductSnapshot>;
  },
  staleTime: 30 * 1000,       // fresh 30s, sau đó background refetch
  refetchOnWindowFocus: false,
  retry: 2,
});
```

**Snapshot endpoint nhận slug, backend accept `{idOrSlug}`:**

```java
// CatalogController.java:100-107
@GetMapping("/products/{idOrSlug}/snapshot")
public ApiDataResponse<ProductSnapshotResponse> getProductSnapshot(
    @PathVariable String idOrSlug, ...) {
    Product product = catalogReadService.getProductByIdOrSlug(idOrSlug);  // accepts both
```

**Kết luận CSR:** Slug-as-id là ĐÚNG, không phải bug. Snapshot one-shot cho pricing+stock+variants là architecture đúng.

### Bảng CSR component analysis:

| Component/Page | CSR data | Lý do CSR | staleTime | SEO impact | Đánh giá |
|---|---|---|---|---|---|
| `PurchaseSectionClient` | pricing, stock, variants | Cần fresh, personalised | 30s | Không (fallback ISR data hiển thị trước) | ĐÚNG |
| `ReviewsSection` | reviews list | Luôn cần fresh, user-submitted | Default 60s | Thấp (rating count có trong ISR HTML) | ĐÚNG |
| `RecentlyViewedSection` | localStorage | Client-only | N/A | Không | ĐÚNG |
| Cart (`gio-hang`) | localStorage + API | User-specific | N/A | Không | ĐÚNG |
| Checkout | session state | User flow | N/A | Không | ĐÚNG |
| Auth/Profile | JWT + API | User-specific | N/A | Không | ĐÚNG |
| Search (tim-kiem) | search API `no-store` | User query | N/A | Không (noindex) | ĐÚNG |

**PDP SEO HTML có đủ không?**
- `app/product/[slug]/page.tsx` renders server-side: title, meta description, canonical URL, OG image, JSON-LD (Product, BreadcrumbList, FAQPage), product name, short description, gallery, tabs, specifications.
- Price/stock/variants được render dưới dạng fallback (ISR data từ `product.price`, `product.stockState`, `product.variants`), sau đó CSR snapshot override.
- Googlebot thấy ISR HTML có đủ structured data. Dynamic data (real-time price) được CSR sau DOMContentLoaded — Google không cần realtime price để index.

**Mismatch/hydration risk:** Fallback ISR data và CSR snapshot data cùng kiểu (`ProductPrice`, `ProductVariant[]`) — không có hydration mismatch risk vì pattern là: ISR fallback hiển thị trước → CSR snapshot override sau. Không dùng SSR + CSR cùng lúc trên cùng component.

---

## 7. Reload Behavior Verification

> **Câu hỏi chính:** Sau khi admin cập nhật dữ liệu public, reload trang có thấy dữ liệu mới không?

| Data update | Page cần cập nhật | Tags cần purge | Hiện tại có purge? | Reload thấy mới? | Rủi ro |
|---|---|---|---|---|---|
| Đổi tên product | PDP, listing, home, category, brand pages | `products`, `product:{slug}` | YES | **Đảm bảo nếu webhook OK** | Webhook fail = stale max 3600s |
| Đổi slug product | PDP (old 404 → new), listing | `products`, `product:{old}`, `product:{new}` | YES | **Đảm bảo nếu webhook OK** | Slug rename cần 2 revalidates |
| Đổi giá product | PDP (ISR fallback + CSR snapshot) | `products`, `product:{slug}` | YES (Inventory service) | **Đảm bảo** — snapshot CSR luôn fresh | Snapshot fetch is no-store, không cần ISR purge |
| Đổi stock product | PDP stock display | `products`, `product:{slug}` | YES (Inventory service) | **Đảm bảo** — snapshot CSR luôn fresh | Như trên |
| Đổi ảnh product | PDP gallery | `products`, `product:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi category product | PDP breadcrumb, related list | `products`, `product:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi brand product | PDP brand name | `products`, `product:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Publish product | Listing (product appears) | `products`, `product:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Unpublish product | Listing (product gone), PDP → 404 | `products`, `product:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi category name | Category PDP header, breadcrumb | `categories`, `category:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi category slug | Category old URL | `categories`, `category:{old}`, `category:{new}` | YES | **Đảm bảo nếu webhook OK** | |
| Category thay đổi → nav menu cập nhật | Header/footer nav menu | **`menus`** nhưng backend gửi **`menu:primary`** | **KHÔNG** | **KHÔNG ĐẢM BẢO** | **BUG-001 — P0** |
| Đổi brand name/slug | Brand PDP, listing | `brands`, `brand:{old}`, `brand:{new}`, `products` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi homepage slider | Homepage hero | `sliders` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi menu header (via AdminMenuService) | Header/footer | `menus` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi setting hotline/footer | Homepage, layout | `settings` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi SEO home title | Homepage metadata | `settings` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi article title/body/slug | Article PDP, listing | `articles`, `article:{old}`, `article:{new}` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi article status (publish/unpublish) | Article PDP, listing | `articles`, `article:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi static page content/SEO | Static page | `pages`, `page:{slug}` | YES | **Đảm bảo nếu webhook OK** | |
| Approve review → rating count | PDP rating display | `product:{slug}`, `products` | YES (AdminReviewService:192) | **Đảm bảo** — ISR purge + snapshot CSR | |
| Đổi home video | Homepage video section | `home-videos` | YES | **Đảm bảo nếu webhook OK** | |
| Đổi redirect rule | Redirect proxy | `redirects` → dead tag | KHÔNG (redirect dùng in-process cache, TTL-based) | Cập nhật sau max `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` (default 30s) | Documented in `.env.example:22` — không phải bug |

---

## 8. Runtime/Deployment Env

| Item | Giá trị/Phát hiện | Đánh giá |
|---|---|---|
| Web env `REVALIDATE_SECRET` | `bigbike-web/.env.example:14` | Documented |
| Backend env `WEB_REVALIDATE_SECRET` | Được map vào `bigbike.web.revalidate-secret` | OK |
| Backend env `WEB_REVALIDATE_URL` | `bigbike.web.revalidate-url` | OK |
| Docker-compose backend | `WEB_REVALIDATE_URL: "http://bigbike-web:3000/api/revalidate"` (line 86) | Đúng — internal Docker network |
| Docker-compose backend | `WEB_REVALIDATE_SECRET: "${WEB_REVALIDATE_SECRET:-}"` (line 87) | **BUG-002** — default rỗng |
| Docker-compose web | `REVALIDATE_SECRET: "${WEB_REVALIDATE_SECRET:-}"` (line 139) | **BUG-002** — default rỗng |
| Secret match web/backend | Cùng `WEB_REVALIDATE_SECRET` env var → cùng giá trị | ĐÚNG |
| Healthcheck / smoke test | `docker-compose.yaml:197-200` — curl POST revalidate với tags list | CÓ — tốt |
| Smoke test tags | `products,sliders,categories,articles,brands,settings,menus,pages` | OK — cover các tags chính. Thiếu `home-videos` |
| Production thiếu secret | Revalidation fail silently (backend: `log.warn`), web: 401 tất cả | Chấp nhận được nhưng cần alert |

---

## 9. Test Coverage

### Backend tests hiện có:

| Test | File | Covers |
|---|---|---|
| `revalidate_postsDeduplicatedTagsToConfiguredWebhook` | `WebRevalidationServiceTest.java:55` | Dedup, secret header, JSON body format |
| `revalidate_defersWebhookUntilTransactionCommit` | `WebRevalidationServiceTest.java:66` | Transaction-safe dispatch |

### Tests còn thiếu (ưu tiên):

| Priority | Test cần thêm | Lý do |
|---|---|---|
| P0 | Frontend unit test: `POST /api/revalidate` với secret đúng/sai | Verify 200/401 behavior |
| P0 | Frontend unit test: `revalidateTag` được gọi với đúng tags | Verify ISR purge trigger |
| P1 | Backend integration test: `updateCategory` gửi đúng tags | Verify BUG-001 fix |
| P1 | Backend integration test: `updateProduct` gửi slug cũ + mới | Verify slug rename |
| P1 | `WebRevalidationService` test: HTTP failure → `log.warn`, no throw | Verify graceful failure |
| P2 | E2E (Playwright/Cypress): Admin update product name → reload public PDP → thấy tên mới | Golden path ISR e2e |
| P2 | E2E: Admin change menu item → reload homepage → menu updated | Cover BUG-001 after fix |
| P3 | Snapshot route test: Slug được truyền đúng sang backend | Verify CSR proxy |

---

## 10. Kết luận

### Evidence quan trọng nhất:

- `bigbike-web/app/api/revalidate/route.ts:45` — `revalidateTag(tag, { expire: 0 })` ĐÚNG cho Next.js 16.x (`CacheLifeConfig = { expire?: number }`)
- `bigbike-web/node_modules/next/dist/server/web/spec-extension/revalidate.d.ts` — xác nhận type `export declare function revalidateTag(tag: string, profile: string | CacheLifeConfig): undefined`
- `bigbike-backend/.../AdminCatalogMutationService.java:1369` — `revalidateEntityTags("categories", "category:", previousSlug, entity.getSlug(), "products", "menu:primary")` — gửi `menu:primary`
- `bigbike-web/lib/api/public-api.ts:350` — `getPublicMenu()` dùng tag `"menus"` — không match
- `bigbike-backend/.../WebRevalidationService.java:75` — `log.warn(...)` chỉ log, không retry
- `docker-compose.yaml:87` — `WEB_REVALIDATE_SECRET: "${WEB_REVALIDATE_SECRET:-}"` — default rỗng
- `bigbike-backend/.../CatalogController.java:102-107` — `@GetMapping("/products/{idOrSlug}/snapshot")` — accept cả slug lẫn ID, xác nhận CSR call đúng

---

## Findings

### BUG-001 — P0: Tag mismatch `menu:primary` vs `menus` — Category mutations không purge menu ISR cache

**Severity:** P0  
**File/Line:**
- `bigbike-backend/.../AdminCatalogMutationService.java:1369` — gửi tag `"menu:primary"`
- `bigbike-web/lib/api/public-api.ts:350` — `getPublicMenu()` fetch tagged `"menus"`

**Mô tả:** Khi admin tạo/sửa/xóa category, `revalidateCategory()` gửi tag `"menu:primary"` lên `/api/revalidate`. Nhưng `getPublicMenu(location)` trong `public-api.ts` được tagged là `"menus"`, không phải `"menu:primary"`. Hai tag không khớp — `revalidateTag("menu:primary")` được gọi nhưng không có ISR fetch nào dùng tag này → no-op hoàn toàn.

**Impact:** Khi admin thêm category mới vào nav menu (thông qua category update), menu header/footer trên trang public KHÔNG được purge. Người dùng thấy menu cũ trong tối đa 3600s.

**Reproduction:**
1. Admin sửa category, ví dụ đổi tên
2. Backend gọi `revalidateCategory()` → gửi `"menu:primary"` tới `/api/revalidate`
3. Endpoint gọi `revalidateTag("menu:primary", { expire: 0 })`
4. Không có Next.js fetch nào dùng tag `"menu:primary"` → cache không invalidated
5. Menu ISR cache của `getPublicMenu("primary")` (tagged `"menus"`) giữ nguyên đến 3600s

**Fix:**
```java
// AdminCatalogMutationService.java:1369 — đổi "menu:primary" thành "menus"
private void revalidateCategory(CategoryEntity entity, String previousSlug) {
    revalidateEntityTags("categories", "category:", previousSlug, entity.getSlug(), "products", "menus");
    //                                                                                               ^^^^^ đổi từ "menu:primary"
}
```

**Test recommendation:** Integration test assert tag `"menus"` được gửi khi category update.

---

### BUG-002 — P1: `WEB_REVALIDATE_SECRET` empty mặc định trong docker-compose

**Severity:** P1  
**File/Line:** `docker-compose.yaml:87,139,199`

**Mô tả:** `WEB_REVALIDATE_SECRET: "${WEB_REVALIDATE_SECRET:-}"` dùng bash fallback rỗng. Nếu developer/DevOps không set `WEB_REVALIDATE_SECRET` trong host environment, secret là empty string trên cả backend và web. Backend sẽ disable revalidation (`enabled=false`). Web sẽ reject tất cả requests với 401 (fail-safe). Revalidation sẽ không hoạt động mà không có error rõ ràng — chỉ `log.info("WebRevalidationService enabled=false")`.

**Impact:** Production hoặc staging deploy thiếu secret → revalidation disabled silently → cache stale 3600s sau mọi admin update.

**Fix:**
```yaml
# Option 1: Dùng required: true (Docker Compose 3.x+)
secrets:
  revalidate_secret:
    environment: WEB_REVALIDATE_SECRET

# Option 2: Fail fast startup nếu thiếu secret
WEB_REVALIDATE_SECRET: "${WEB_REVALIDATE_SECRET:?WEB_REVALIDATE_SECRET must be set}"
```

**Test recommendation:** CI/CD pipeline check `WEB_REVALIDATE_SECRET` là non-empty trước khi deploy.

---

### BUG-003 — P1: Không có retry/durable outbox cho revalidation HTTP failure

**Severity:** P1  
**File/Line:** `bigbike-backend/.../WebRevalidationService.java:64-78`

**Mô tả:** `dispatch()` gửi HTTP POST async. Nếu Next.js web đang restart, overloaded, hoặc network glitch → `restClient.post()...retrieve()` ném exception → chỉ `log.warn(...)` → request bị drop. Cache không được purge. Không có retry, không có queue, không có dead-letter.

**Impact:** Admin update dữ liệu → webhook fail → cache stale tối đa 3600s → user thấy data cũ. Trong production với rolling deploy (web restart), revalidation có thể bị drop trong cửa sổ vài giây.

**Fix Options (theo độ phức tạp):**
1. **Simple:** Thêm exponential backoff retry (3 lần, delay 1s/2s/5s) trong `dispatch()` trước khi log.warn
2. **Production-grade:** Thêm outbox table `web_revalidation_outbox(id, tags, created_at, retried_at, attempts)`. Background job retry mỗi 60s với max 5 attempts.
3. **Overkill:** Event streaming (Kafka/SQS) — không cần ở scale này.

**Test recommendation:** Unit test verify service không throw khi HTTP call fails.

---

### BUG-004 — P2: Tag `redirects` là dead tag — không có ISR fetch nào dùng nó

**Severity:** P2  
**File/Line:**
- `bigbike-backend/.../AdminRedirectService.java:155,209,221` — gửi `"redirects"`
- `bigbike-web/.env.example:22` — documented: `revalidateTag("redirects") does NOT clear this Map — only TTL expiry does`

**Mô tả:** `AdminRedirectService` gửi tag `"redirects"` sau mỗi redirect CRUD. Nhưng redirect proxy sử dụng in-process `Map` với TTL (env `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS`, default 30s). `revalidateTag("redirects")` không ảnh hưởng đến Map này. Tag này đã được documented trong `.env.example` nhưng có thể gây nhầm lẫn cho người maintain.

**Impact:** Khi admin tạo/sửa redirect, redirect cache in-process vẫn phải chờ TTL hết (30s default). Nếu developer expect `revalidateTag` sẽ clear redirect cache ngay → sai.

**Fix Option 1:** Xóa `webRevalidationService.revalidate("redirects")` khỏi `AdminRedirectService` (vì nó là no-op).  
**Fix Option 2:** Implement proper cache invalidation cho redirect proxy khi `revalidateTag("redirects")` được gọi.

---

### BUG-005 — P2: Reviews route thiếu `export const dynamic = "force-dynamic"`

**Severity:** P2  
**File/Line:** `bigbike-web/app/api/products/[id]/reviews/route.ts`

**Mô tả:** Reviews route không có `export const dynamic = "force-dynamic"`, khác với tất cả các route khác trong cùng folder (`pricing`, `stock`, `variants`, `snapshot` đều có). Trong Next.js 16, route handlers không có `dynamic = "force-dynamic"` có thể bị treated là static-eligible, dẫn đến caching không mong muốn.

**Fix:**
```typescript
// Thêm vào đầu file
export const dynamic = "force-dynamic";
```

---

### BUG-006 — P3: `search-suggest` route có thể bị Next.js cache static

**Severity:** P3  
**File/Line:** `bigbike-web/app/api/search-suggest/route.ts`

**Mô tả:** Route không có `export const dynamic` declaration. Dùng `next: { revalidate: 30 }` trên backend fetch và set `Cache-Control: public, s-maxage=30`. Không có `dynamic = "force-dynamic"` trong Next.js 16 có thể khiến route bị treated là static-eligible tại build time.

**Fix:** Thêm `export const dynamic = "force-dynamic"` vì search suggest là per-query, không nên static.

---

### NOTE-001 — P3: pricing/stock/variants routes có vẻ là dead code

**Severity:** P3  
**File/Line:** `bigbike-web/app/api/products/[id]/pricing/route.ts`, `stock/route.ts`, `variants/route.ts`

**Mô tả:** `PurchaseSectionClient.tsx:112` chỉ gọi `/api/products/${productSlug}/snapshot/` — một request trả về pricing + stock + variants cùng lúc. Các route `pricing`, `stock`, `variants` không được gọi từ bất kỳ component nào tìm được trong codebase. Chúng có thể là legacy routes từ trước khi snapshot endpoint được tạo.

**Impact:** Không có bug, chỉ là dead code tốn maintenance. Nếu một component nào đó gọi chúng mà không tìm thấy, cần verify lại.

**Fix:** Nếu xác nhận unused, xóa 3 files này. Nếu được dùng bởi mobile app, giữ lại và document.

---

## Verdict

**PASS WITH RISKS**

Kiến trúc ISR + CSR hybrid được thiết kế đúng và chuyên nghiệp:
- ISR 3600s trên tất cả public SEO pages
- On-demand revalidation qua tag system được implement đúng
- Transaction-safe dispatch (after commit) đúng
- CSR hybrid cho dynamic data (pricing/stock/variants) đúng
- PDP HTML SEO đủ structured data

Reload sau admin update **hoạt động với điều kiện:**
1. `WEB_REVALIDATE_SECRET` được set đúng trên production (BUG-002)
2. Revalidation HTTP call thành công (không có retry — BUG-003)

Một bug P0 cụ thể: **Category mutations không invalidate menu ISR cache** (BUG-001) — người dùng thấy menu cũ tối đa 1 giờ sau khi admin sửa category. Fix 1 dòng.

---

## Score

**7.5 / 10**

| Tiêu chí | Điểm |
|---|---|
| ISR architecture đúng | 2/2 |
| CSR hybrid đúng | 2/2 |
| On-demand revalidation endpoint | 1.5/2 (thiếu logging, retry) |
| Backend pipeline | 1/2 (không retry, BUG-001 mismatch) |
| Env/deployment | 0.5/1 (BUG-002 empty secret default) |
| Test coverage | 0.5/1 (backend OK, frontend zero) |

---

*File được tạo bởi audit tự động. Engineer cần fix BUG-001 (1 dòng) trước khi production release.*
