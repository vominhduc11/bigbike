# BigBike Data Contract

Audit date: 2026-05-04

## 1. Document Purpose

File này mô tả canonical data contract của BigBike: dữ liệu có shape như thế nào, domain nào là source of truth, field nào được public web/admin/mobile dùng, field nào internal/admin-only, field nào nullable/optional, enum/status nào tồn tại và chỗ nào đang bị lệch contract.

Audience chính:

- Developer backend/frontend/admin/mobile.
- Tester/QA.
- AI agent triển khai code.
- PM kỹ thuật cần hiểu data shape mà không cần đọc từng class như đang lần mò hang động bằng đèn pin yếu.

Nguyên tắc audit:

- Backend domain/entity/DTO/schema được ưu tiên làm source of truth khi có evidence.
- Frontend/admin/mobile chỉ là consumers, trừ khi backend chưa có evidence.
- Không ghi secret/token/password/private key/env value.
- Không nhồi endpoint detail. Endpoint detail thuộc `API_CONTRACT.md`.
- Không tự bịa field/entity/enum. Field không có evidence sẽ bị đánh dấu rõ.

## 2. Data Contract Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_CODE` | Đã thấy trực tiếp trong source code, DTO, entity, domain record, OpenAPI, hoặc mapper. |
| `BACKEND_ONLY` | Có ở backend nhưng chưa thấy frontend/admin/mobile dùng rõ. |
| `FRONTEND_ONLY` | Có ở frontend/admin/web nhưng chưa thấy backend source of truth tương ứng. |
| `MOBILE_ONLY` | Có ở mobile nhưng chưa thấy backend/web/admin source of truth tương ứng. |
| `DOCUMENTED_NOT_FOUND` | Docs nhắc tới nhưng code audit hiện tại chưa thấy. |
| `LEGACY_FALLBACK` | Field/fallback phục vụ legacy WordPress/mock/backward compatibility. |
| `NEEDS_VERIFICATION` | Có evidence một phần nhưng cần audit sâu hơn hoặc runtime/test để kết luận chắc. |
| `NOT_FOUND_IN_REPO` | Không thấy evidence trong repo qua audit hiện tại. |
| `CONFLICTING_EVIDENCE` | Code/docs/FE/BE đưa ra evidence lệch nhau. |

## 3. Canonical Data Ownership

| Data Area | Source of Truth | Consumers | Status | Evidence |
|---|---|---|---|---|
| Product | Backend `ProductEntity`, domain `Product`, admin `UpsertProductRequest` | Public web, admin, mobile | `CONFIRMED_FROM_CODE` | `bigbike-backend/.../ProductEntity.java`, `domain/catalog/Product.java`, `api/admin/dto/UpsertProductRequest.java`, `bigbike-web/lib/contracts/public.ts`, `bigbike-admin/src/lib/contracts.js` |
| Category | Backend domain `Category` and catalog entity/mappers | Public web, admin | `CONFIRMED_FROM_CODE` | `domain/catalog/Category.java`, `bigbike-web/lib/contracts/public.ts`, `bigbike-admin/src/lib/contracts.js` |
| Brand | Backend domain `Brand` and catalog entity/mappers | Public web, admin | `CONFIRMED_FROM_CODE` | `domain/catalog/Brand.java`, `bigbike-web/lib/contracts/public.ts`, `bigbike-admin/src/lib/contracts.js` |
| Cart | Backend cart DTO/service | Public web/mobile checkout flows | `CONFIRMED_FROM_CODE` | `api/cart/dto/CartResponse.java`, `CartItemResponse.java`, `CartTotalsResponse.java` |
| Checkout | Backend checkout DTO/service | Public web/mobile | `CONFIRMED_FROM_CODE` | `api/checkout/dto/CheckoutRequest.java`, `CheckoutAddressRequest.java`, `OrderSummaryResponse.java` |
| Order | Backend order entity and order DTOs | Public customer, admin, mobile | `CONFIRMED_FROM_CODE` | `persistence/entity/commerce/order/OrderEntity.java`, `api/order/dto/*`, `bigbike-admin/src/lib/contracts.js` |
| Payment | Backend order payment records/status fields | Public customer, admin | `CONFIRMED_FROM_CODE`; external provider `NOT_FOUND_IN_REPO` | `OrderEntity.java`, `OrderPaymentResponse.java`, `PaymentStatus.java` |
| Shipping | Backend shipping zone/method entities/service + order shipping DTO | Checkout/admin/order detail | `CONFIRMED_FROM_CODE`; external carrier `NOT_FOUND_IN_REPO` | `AdminShippingService.java`, `OrderShippingItemResponse.java` |
| Inventory / Stock | Backend product/variant stock fields + inventory DTOs | Admin, product UI/mobile badges | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `ProductVariant.java`, `AdminStockItemResponse.java`, `StockMovementResponse.java` |
| Return / Refund | Backend return DTOs + order refund fields | Admin, customer order returns | `CONFIRMED_FROM_CODE` | `AdminReturnDetailResponse.java`, `CustomerReturnResponse.java`, `OrderEntity.java` |
| Customer | Backend customer DTOs/entities | Customer account, admin | `CONFIRMED_FROM_CODE` | `CustomerSummary.java`, `CustomerAddressResponse.java`, `AdminCustomerDetailResponse.java` |
| Admin User / Role | Backend auth domain profile and admin user/role controllers | Admin | `CONFIRMED_FROM_CODE`; full permission catalog `NEEDS_VERIFICATION` | `domain/auth/AdminUserProfile.java`, admin auth/role controllers from backend compile list |
| Media | Backend media DTO/service/MinIO config | Admin, catalog/content image references | `CONFIRMED_FROM_CODE` | `AdminMediaDetailResponse.java`, `ImageAsset.java`, `bigbike-admin/src/lib/contracts.js` |
| Content / Page / Blog | Backend content domain `Article`, `Page` | Public web, admin | `CONFIRMED_FROM_CODE` | `domain/content/Article.java`, `Page.java`, `bigbike-web/lib/contracts/public.ts` |
| Settings | Backend setting DTOs | Public web, admin | `CONFIRMED_FROM_CODE` | `AdminSiteSettingResponse.java`, `PublicSiteSettingResponse.java`, `bigbike-admin/src/lib/contracts.js` |
| Menu | Backend menu DTOs | Public web, admin | `CONFIRMED_FROM_CODE` | `AdminMenuResponse.java`, `AdminMenuItemResponse.java`, `bigbike-web/lib/contracts/public.ts` |
| Coupon | Backend coupon DTOs/cart coupon flow | Cart, checkout, admin | `CONFIRMED_FROM_CODE` | `AdminCouponDetailResponse.java`, `CartResponse.java`, `bigbike-admin/src/lib/contracts.js` |
| Review | Backend `ReviewEntity`, public review list DTO, aggregate query + admin/public review controllers | Product/review UI/admin moderation/audit | `CONFIRMED_FROM_CODE`; admin moderation payload includes product metadata used by admin list/detail UX, and review moderation writes audit `beforeData`/`afterData` snapshots that retain review id, product metadata, author fields, rating, body, status, timestamps | `ReviewEntity.java`, `PublicReviewController.java`, `PublicReviewService.java`, `AdminReviewController.java`, `AdminReviewService.java`, `ReviewJpaRepository.java`, `SubmitReviewRequest.java`, `AuditLogEntity.java` |
| Report | Backend dashboard/report DTO/controllers | Admin | `CONFIRMED_FROM_CODE`; metric semantics `NEEDS_VERIFICATION` | `AdminDashboardSummaryResponse.java` path in compile list, `AdminReportController` path in architecture docs |
| Notification | Backend notification hooks/service; no persisted notification data contract verified | Admin/customer email/ws maybe | `NEEDS_VERIFICATION` | `docs/engineering/ARCHITECTURE.md` references notification hooks; no canonical notification entity audited |

## 4. Entity / DTO Summary

| Domain | Backend Entity / DTO | Frontend Model / Usage | Mobile Model / Usage | Status | Evidence |
|---|---|---|---|---|---|
| Product | `ProductEntity`, `Product`, `UpsertProductRequest` | `Product` type in `public.ts`, `normalizeProduct` in admin | Status badge consumes stock values | `CONFIRMED_FROM_CODE` | Product/entity/domain/request/web/admin/mobile status badge paths |
| Product media | `ImageAsset`, gallery/video/spec DTOs/entities | `ImageAsset`, `VideoAsset`, admin normalizers | Product image usage `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | `ImageAsset.java`, `public.ts`, `contracts.js` |
| Category | `Category`, `UpsertCategoryRequest` | `Category` type, admin normalizer | `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | `Category.java`, `public.ts`, `contracts.js` |
| Brand | `Brand`, `UpsertBrandRequest` | `Brand` type, admin normalizer | `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | `Brand.java`, `public.ts`, `contracts.js` |
| Cart | `CartResponse`, `CartItemResponse`, `CartTotalsResponse` | Cart UI/API clients | Checkout/cart screens `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | cart DTO paths |
| Checkout | `CheckoutRequest`, `CheckoutAddressRequest`, `OrderSummaryResponse` | Checkout UI/API clients | Checkout screen `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | checkout DTO paths |
| Order | `OrderEntity`, `OrderDetailResponse`, `OrderLineItemResponse` etc. | Admin `normalizeOrder`, web account order pages | Mobile order screens/status badge | `CONFIRMED_FROM_CODE`; admin drift exists | order DTO/entity/admin/mobile paths |
| Customer | `CustomerSummary`, `CustomerAddressResponse`, `AdminCustomerDetailResponse` | Account/admin customer UI | Account screens `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | customer DTO paths |
| Media | `AdminMediaDetailResponse`, `ImageAsset` | Admin media normalizer, public image fields | `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | media DTO/admin contract paths |
| Content | `Article`, `Page` | `Article`, `Page` type in public web | Content route screens `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | content domain/public web paths |
| Review | `ReviewEntity`, public review list/aggregate response, admin moderation map payload | `ReviewsSection.tsx` consumes `avgRating`, `totalReviews`, `reviews[]`, `pagination`; admin reviews consume `productId`, `productName`, `productSlug`, author fields, rating, `body`, `status`, timestamps; mobile `ProductReview` consumes item fields and mobile submit posts `authorName`, `rating`, `comment` to the public review endpoint | Mobile ignores pagination and keeps item-level compatibility on read; submit path mirrors backend validation contract | `CONFIRMED_FROM_CODE` for public + admin payload | `ReviewEntity.java`, `PublicReviewController.java`, `PublicReviewService.java`, `AdminReviewController.java`, `AdminReviewService.java`, `bigbike-web/components/catalog/ReviewsSection.tsx`, `bigbike-admin/src/lib/adminApi.js`, `bigbike_mobile/lib/core/models/product.dart`, `bigbike_mobile/lib/features/products/product_detail_screen.dart` |
| Settings/Menu/Coupon | DTOs in admin/public packages | Admin normalizers, public web contracts | `NEEDS_VERIFICATION` | `CONFIRMED_FROM_CODE` | setting/menu/coupon paths |

## 5. Product Data Contract

Canonical source: backend `ProductEntity` persistence shape + domain `Product` response shape. Public consumer should prefer domain/API shape (`image: ImageAsset`, `price: ProductPrice`, `seo: SeoMeta`) over raw DB scalar image/seo columns. Raw entity scalar fields exist because the database stores flattened image/SEO columns; the canonical application-level shape wraps them.

| Field | Type / Shape | Required | Public Web | Admin | Mobile | Notes | Status | Evidence |
|---|---|---:|---:|---:|---:|---|---|---|
| `id` | string | Yes | Yes | Yes | Likely | Product identifier | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `Product.java` |
| `legacyId` | string | No | No | Admin/internal | No | Legacy WordPress import id | `BACKEND_ONLY` | `ProductEntity.java` |
| `sku` | string | No | Yes | Yes | Likely | Admin validates max 100 | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `UpsertProductRequest.java` |
| `slug` | string | Yes | Yes | Yes | Likely | Unique, slug regex in request | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `UpsertProductRequest.java` |
| `name` | string | Yes | Yes | Yes | Likely | Admin validates max 255 | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `UpsertProductRequest.java` |
| `shortDescription` | text/string | No | Yes | Yes | Likely | Admin max 2000 | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `UpsertProductRequest.java` |
| `description` | text/string | No | Yes | Yes | Likely | Admin max 20000 | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `UpsertProductRequest.java` |
| `brand` / `brandId` | `BrandSummary` / string id | No | Yes | Yes | Likely | Entity relation nullable | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `Product.java` |
| `category` / `categoryId` | `CategorySummary` / string id | Yes | Yes | Yes | Likely | Entity `category_id` non-null | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `Product.java` |
| `categories` | `CategorySummary[]` | No | Yes | Yes | Unknown | Many-to-many category map | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `Product.java` |
| `tags` | `ProductTagEntity[]` internal | No | Not in public `Product` | Admin unclear | Unknown | Entity has tags but domain `Product` record does not expose tags | `BACKEND_ONLY` | `ProductEntity.java`, `Product.java` |
| `image` | `ImageAsset {id,url,alt,width,height,mimeType}` | No | Yes | Yes | Likely | Entity stores flattened `imageId/imageUrl/imageAlt/...` | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `ImageAsset.java`, `Product.java` |
| `gallery` | `ImageAsset[]` | No | Yes | Yes | Likely | Admin request max 50 images | `CONFIRMED_FROM_CODE` | `Product.java`, `UpsertProductRequest.java` |
| `videos` | `VideoAsset[]` | No | Yes | Yes | Unknown | Admin request max 20 | `CONFIRMED_FROM_CODE` | `Product.java`, `UpsertProductRequest.java`, `public.ts` |
| `price` | `ProductPrice {retailPrice,compareAtPrice,salePrice,currency}` | `retailPrice`, `currency` yes | Yes | Yes | Likely | Entity stores scalar prices; currency must be VND in admin request | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `ProductPrice.java`, `UpsertProductRequest.java` |
| `variants` | `ProductVariant[]` | No | Yes | Yes | Unknown | Admin request max 200 variants | `CONFIRMED_FROM_CODE` | `ProductVariant.java`, `UpsertProductRequest.java` |
| `specifications` | `{name,value,group}[]` | No | Yes | Yes | Unknown | Admin request max 100 specs | `CONFIRMED_FROM_CODE` | `ProductSpecification.java`, `UpsertProductRequest.java` |
| `stockState` | `ProductStockState` | Yes | Yes | Yes | Yes badge | Enum values in registry | `CONFIRMED_FROM_CODE` | `ProductStockState.java`, `Product.java`, `status_badge.dart` |
| `stockQuantity` | integer nullable | No | Public contract currently product lacks it | Inventory/admin | Unknown | Domain `Product` has product-level count, web `Product` type currently omits it | `CONFLICTING_EVIDENCE` | `Product.java`, `public.ts` |
| `manageStock`, `backorders` | boolean/string | No | No | Internal/admin unclear | No | Present in entity, not domain `Product` | `BACKEND_ONLY` | `ProductEntity.java` |
| `weightKg`, `lengthCm`, `widthCm`, `heightCm` | decimal nullable | No | No | Admin unclear | No | Entity-only dimensions | `BACKEND_ONLY` | `ProductEntity.java` |
| `forceOutOfStock` | boolean nullable | No | Domain yes, public web omits | Admin yes | Unknown | Web public TS `Product` omits this field | `CONFLICTING_EVIDENCE` | `Product.java`, `ProductEntity.java`, `public.ts` |
| `publishStatus` | `PublishStatus` | Yes | Yes | Yes | Unknown | Backend enum wider than web/admin contract | `CONFLICTING_EVIDENCE` | `PublishStatus.java`, `public.ts`, `contracts.js` |
| `isFeatured` | boolean | No | Yes | Yes | Unknown | Product visibility/home sections | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `Product.java` |
| `showOnHomepage` | boolean | No | Yes | Yes | Unknown | Homepage filtering | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `Product.java` |
| `rating`, `ratingCount` | decimal/integer nullable | No | Yes | Admin partly | Unknown | Historical origin is WP legacy/V43, but from Phase 2D onward runtime source-of-truth is the approved-review aggregate; product fields are denormalized cache for fast reads | `CONFIRMED_FROM_CODE` | `Product.java`, `ProductEntity.java`, `AdminReviewService.java`, `V63__sync_product_rating_cache_from_reviews.sql` |
| `contentBottom` | text/html nullable | No | Yes | Yes | Unknown | Long-form PDP SEO content | `CONFIRMED_FROM_CODE` | `Product.java`, `UpsertProductRequest.java` |
| `seo` | `SeoMeta {title,description,canonicalUrl,ogImage,noIndex}` | No | Yes | Yes | Unknown | Entity stores flattened SEO columns | `CONFIRMED_FROM_CODE` | `SeoMeta.java`, `ProductEntity.java` |
| `createdAt`, `updatedAt` | instant/string | Yes | Yes | Yes | Likely | Auditing timestamps | `CONFIRMED_FROM_CODE` | `ProductEntity.java`, `Product.java` |

### Product nested shapes

| Shape | Fields | Status | Evidence |
|---|---|---|---|
| `ImageAsset` | `id`, `url`, `alt`, `width`, `height`, `mimeType` | `CONFIRMED_FROM_CODE` | `ImageAsset.java`, `public.ts` |
| `ProductPrice` | `retailPrice`, `compareAtPrice`, `salePrice`, `currency` | `CONFIRMED_FROM_CODE` | `ProductPrice.java` |
| `ProductVariant` | `id`, `sku`, `name`, `options`, `price`, `stockState`, `stockQuantity`, `image`, `gallery`, `isAvailable` | `CONFIRMED_FROM_CODE` | `ProductVariant.java` |
| `ProductSpecification` | `name`, `value`, `group` | `CONFIRMED_FROM_CODE` | `ProductSpecification.java` |
| `SeoMeta` | `title`, `description`, `canonicalUrl`, `ogImage`, `noIndex` | `CONFIRMED_FROM_CODE` | `SeoMeta.java` |

## 6. Category / Brand Data Contract

### Category — response shape (GET)

Canonical source: backend domain `Category.java` record → serialized by Spring to JSON. Public and admin endpoints both use the same `Category` domain type.

| Field | Type / Shape | Required | Public Web | Admin | Mobile | Notes | Status | Evidence |
|---|---|---:|---:|---:|---:|---|---|---|
| `id` | string | Yes | Yes | Yes | Yes | Identifier | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `slug` | string | Yes | Yes | Yes | Yes | Route/filter key | `CONFIRMED_FROM_CODE` | `Category.java`, `public.ts`, `category.dart` |
| `name` | string | Yes | Yes | Yes | Yes | Display name | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `description` | string nullable | No | Yes | Yes | Yes | Optional copy | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `parentId` | string nullable | No | Yes | Yes | Yes | Hierarchical category | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `image` | `ImageAsset` nullable | No | Yes | Yes | Yes | Category image | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `icon` | `ImageAsset` nullable | No | Yes | Yes | Yes | Icon category UI | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `seo` | `SeoMeta` nullable | No | Yes | Yes | No | SEO metadata; mobile `Category.fromJson` does not read this field | `CONFIRMED_FROM_CODE` (web/admin); `NOT_FOUND_IN_REPO` (mobile) | `Category.java`, `public.ts`, `contracts.js`; absent from `category.dart` |
| `isVisible` | boolean | Yes | Yes | Yes | Yes | Visibility flag; public endpoint only returns visible categories | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `showOnHomepage` | boolean nullable | No | Yes | Yes | Yes | Homepage category flag | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `sortOrder` | integer nullable | No | Yes | Yes | Yes | Ordering; null categories sort after non-null ones | `CONFIRMED_FROM_CODE` | `Category.java`, `category.dart` |
| `createdAt`, `updatedAt` | ISO 8601 string | Yes | Yes | Yes | No | Timestamps; mobile `Category.fromJson` does not read these fields | `CONFIRMED_FROM_CODE` (web/admin); `NOT_FOUND_IN_REPO` (mobile) | `Category.java`, `public.ts`; absent from `category.dart` |
| `productCount` | — | — | No | No | `MOBILE_ONLY` | Mobile model declares this field but backend `Category` domain does not emit it; always null/zero from API | `MOBILE_ONLY` | `category.dart` field vs absence in `Category.java` |

**`ImageAsset` shape** (shared by `image`, `icon`, `seo.ogImage`): `{ id?: string, url: string, alt?: string, width?: integer, height?: integer, mimeType?: string }`. Mobile `ImageAsset` omits `id` but that field is optional.

**`SeoMeta` shape**: `{ title?: string, description?: string, canonicalUrl?: string, ogImage?: ImageAsset, noIndex?: boolean }`. OG image follows the same `ImageAsset` shape — notably `seo.ogImage`, not flat `seo.ogImageUrl/ogImageAlt`.

### Category — write contract (POST / PATCH UpsertCategoryRequest)

Admin `POST /api/v1/admin/categories` (create) and `PATCH /api/v1/admin/categories/{id}` (update).

PATCH semantics: each field is optional. If omitted (null at JSON level), the field is left unchanged, **except** `sortOrder` and `showOnHomepage` which follow standard nullable-present logic. See notes below.

| Request Field | Type | Constraints | PATCH behavior if omitted | Notes |
|---|---|---|---|---|
| `slug` | string | regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` | unchanged | Required on POST; optional on PATCH |
| `name` | string | max 255 | unchanged | Required on POST |
| `description` | string | max 5000 | unchanged | |
| `parentId` | string | max 64 | unchanged | Send `""` (empty string) to clear parent; omit to leave unchanged; `trimToNull("")` → null → clears parent |
| `image` | `ImageAssetRequest {url, alt?, width?, height?, mimeType?}` | — | unchanged | Send `{url: null}` to clear image; omit to leave image unchanged |
| `icon` | same as `image` | — | unchanged | Same clear semantics as `image` |
| `seo` | `SeoMetaRequest` | see sub-fields | unchanged | **Omitting `seo` in PATCH leaves all SEO fields unchanged.** This differs from Product which tracks `isSeoPresent()`. Send `seo: {ogImage: null, title: "", ...}` to clear all SEO fields via `applySeo`. |
| `seo.title` | string | max 255 | — | `trimToNull` → null clears |
| `seo.description` | string | max 5000 | — | |
| `seo.canonicalUrl` | string | max 2048 | — | |
| `seo.ogImage` | `ImageAssetRequest` or `null` | — | — | `null` clears OG image columns; `{url, alt?}` sets them |
| `seo.noIndex` | boolean | — | — | |
| `visible` | boolean | — | unchanged | **Note: request field is `visible`, response field is `isVisible` (asymmetric naming)** |
| `showOnHomepage` | boolean | — | unchanged | |
| `sortOrder` | integer | — | unchanged | |

**Visibility guard (Phase 1 business rule):** Both `DELETE /categories/{id}` and `PATCH /categories/{id}` with `visible: false` check for visible children. If any visible child exists, backend returns **HTTP 409 `CONFLICT`** with `error.code: "CONFLICT"`. FE must display this explicitly.

### Brand

| Field | Type / Shape | Required | Public Web | Admin | Mobile | Notes | Status | Evidence |
|---|---|---:|---:|---:|---:|---|---|---|
| `id`, `slug`, `name` | string | Yes | Yes | Yes | Unknown | Brand identity | `CONFIRMED_FROM_CODE` | `Brand.java` |
| `description` | string nullable | No | Yes | Yes | Unknown | Brand copy | `CONFIRMED_FROM_CODE` | `Brand.java` |
| `logo` | `ImageAsset` nullable | No | Yes | Yes | Unknown | Brand logo | `CONFIRMED_FROM_CODE` | `Brand.java` |
| `seo` | `SeoMeta` nullable | No | Yes | Yes | Unknown | SEO metadata | `CONFIRMED_FROM_CODE` | `Brand.java` |
| `isVisible` | boolean | Yes | Yes | Yes | Unknown | Public visibility | `CONFIRMED_FROM_CODE` | `Brand.java` |
| `createdAt`, `updatedAt` | instant/string | Yes | Yes | Yes | Unknown | Timestamps | `CONFIRMED_FROM_CODE` | `Brand.java` |

## 7. Cart / Checkout Data Contract

### Cart

| Field | Type / Shape | Required | Public Web | Admin | Mobile | Notes | Status | Evidence |
|---|---|---:|---:|---:|---:|---|---|---|
| `id` | UUID | Yes | Yes | No | Likely | Cart id | `CONFIRMED_FROM_CODE` | `CartResponse.java` |
| `status` | string / `CartStatus` | Yes | Yes | No | Likely | Enum values: `ACTIVE`, `MERGED`, `ABANDONED`, `CONVERTED`, `EXPIRED` (verified 2026-05-05) | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/commerce/CartStatus.java`, `CartResponse.java` |
| `currency` | string | Yes | Yes | No | Likely | VND expected by commerce flows | `CONFIRMED_FROM_CODE` | `CartResponse.java` |
| `items` | `CartItemResponse[]` | Yes | Yes | No | Likely | Cart line items | `CONFIRMED_FROM_CODE` | `CartItemResponse.java` |
| `totals` | `CartTotalsResponse` | Yes | Yes | No | Likely | subtotal/discount/shipping/fee/total | `CONFIRMED_FROM_CODE` | `CartTotalsResponse.java` |
| `couponCodes` | `string[]` | Yes | Yes | No | Likely | Applied coupon codes | `CONFIRMED_FROM_CODE` | `CartResponse.java` |

### Cart item

| Field | Type / Shape | Required | Notes | Status | Evidence |
|---|---|---:|---|---|---|
| `id` | UUID | Yes | Cart item id | `CONFIRMED_FROM_CODE` | `CartItemResponse.java` |
| `productId`, `productVariantId` | string nullable | Product yes, variant optional | Variant nullable for simple products | `CONFIRMED_FROM_CODE` | `CartItemResponse.java` |
| `sku`, `productName`, `variantName` | string nullable | No | Snapshot display fields | `CONFIRMED_FROM_CODE` | `CartItemResponse.java` |
| `image` | `ImageAsset` nullable | No | Snapshot product image | `CONFIRMED_FROM_CODE` | `CartItemResponse.java` |
| `quantity` | integer | Yes | Quantity | `CONFIRMED_FROM_CODE` | `CartItemResponse.java` |
| `unitPrice`, `lineSubtotal`, `lineDiscount`, `lineTotal` | decimal | Yes | Monetary snapshot | `CONFIRMED_FROM_CODE` | `CartItemResponse.java` |

### Checkout request / summary

| Field | Type / Shape | Required | Public Web | Mobile | Notes | Status | Evidence |
|---|---|---:|---:|---:|---|---|---|
| `billingAddress` | `CheckoutAddressRequest` | Yes | Yes | Likely | `@NotNull @Valid` | `CONFIRMED_FROM_CODE` | `CheckoutRequest.java` |
| `shippingAddress` | `CheckoutShippingAddressRequest` | No | Yes | Likely | Optional separate shipping address | `CONFIRMED_FROM_CODE` | `CheckoutRequest.java` |
| `shippingMethodId` | string | No | Yes | Likely | Selected method id | `CONFIRMED_FROM_CODE` | `CheckoutRequest.java` |
| `paymentMethod` | string | Yes | Yes | Likely | `@NotBlank` | `CONFIRMED_FROM_CODE` | `CheckoutRequest.java` |
| `customerNote` | string | No | Yes | Likely | Customer note | `CONFIRMED_FROM_CODE` | `CheckoutRequest.java` |
| `OrderSummaryResponse` | order id/number/key/status/paymentStatus/paymentMethod/totals/currency/priceChanges | Yes | Yes | Likely | Returned after checkout/quick-buy | `CONFIRMED_FROM_CODE` | `OrderSummaryResponse.java` |

Address shape: `fullName`, `email`, `phone`, `country`, `province`, `district`, `ward`, `addressLine1`, `addressLine2`.

## 8. Order Data Contract

Canonical source: `OrderEntity` for persistence, customer/admin DTOs for response shape.

| Field | Type / Shape | Required | Public Customer | Admin | Mobile | Notes | Status | Evidence |
|---|---|---:|---:|---:|---:|---|---|---|
| `id` | UUID | Yes | Yes | Yes | Yes | Primary order id | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `OrderDetailResponse.java` |
| `legacyId` | Long | No | No | Internal/admin maybe | No | Legacy WP id | `BACKEND_ONLY` / `LEGACY_FALLBACK` | `OrderEntity.java` |
| `orderNumber` | string | No but unique | Yes | Yes | Yes | Human-facing order number | `CONFIRMED_FROM_CODE` | `OrderEntity.java` |
| `orderKey` | string | No but unique | Guest lookup/confirmation only; authenticated customer detail should return `null` | Admin maybe | Unknown | Sensitive-ish lookup key; do not expose beyond guest lookup/confirmation and admin flows | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `OrderDetailResponse.java` |
| `customerId` | UUID nullable | No | Own account context | Admin | Unknown | Guest order can be null | `CONFIRMED_FROM_CODE` | `OrderEntity.java` |
| `status` | `OrderStatus` string | Yes | Yes | Yes | Yes badge | Values in registry | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `OrderStatus.java`, `status_badge.dart` |
| `paymentStatus` | `PaymentStatus` string | Yes | Yes | Yes | Likely | Values in registry | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `PaymentStatus.java` |
| `fulfillmentStatus` | `FulfillmentStatus` string nullable | No | Yes | Yes | Unknown | Shipping/fulfillment lifecycle | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `FulfillmentStatus.java` |
| `customerEmail`, `customerPhone`, `customerNote` | string/text nullable | No | Yes | Yes | Likely | Contact snapshot | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `OrderDetailResponse.java` |
| `currency` | string | Yes | Yes | Yes | Likely | Default VND | `CONFIRMED_FROM_CODE` | `OrderEntity.java` |
| `subtotalAmount`, `discountAmount`, `shippingAmount`, `feeAmount`, `taxAmount`, `totalAmount`, `paidAmount`, `refundAmount` | decimal | Yes | Yes | Yes | Likely | Monetary totals; admin maps to shorter names | `CONFIRMED_FROM_CODE`; admin drift | `OrderEntity.java`, `OrderDetailResponse.java`, `contracts.js` |
| `refundReason`, `refundedAt` | text/instant nullable | No | Yes | Yes | Unknown | Refund metadata | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `OrderDetailResponse.java` |
| `channel`, `fulfillmentType`, `source`, `ipAddress`, `userAgent` | string/text | Mixed | No | Internal/admin unclear | No | Internal provenance. `ipAddress`/`userAgent` should not be public | `BACKEND_ONLY` | `OrderEntity.java` |
| `paymentMethod` | string nullable | Yes after selection | Yes | Yes | Likely | Also appears in payment record | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `OrderSummaryResponse.java` |
| `placedAt`, `paidAt`, `completedAt`, `cancelledAt`, `createdAt`, `updatedAt` | instant nullable/required | Mixed | Yes | Yes | Likely | Customer detail response includes `placedAt`; admin normalizer maps `placedAt` to `createdAt` | `CONFLICTING_EVIDENCE` | `OrderEntity.java`, `OrderDetailResponse.java`, `contracts.js` |
| `lineItems` | `OrderLineItemResponse[]` | Yes | Yes | Yes | Likely | Admin normalizes backend `lineItems` to `items` | `CONFLICTING_EVIDENCE` | `OrderLineItemResponse.java`, `contracts.js` |
| `addresses` | `OrderAddressResponse[]` | Yes | Yes | Yes | Likely | Type-based billing/shipping | `CONFIRMED_FROM_CODE` | `OrderAddressResponse.java` |
| `shippingItems` | `OrderShippingItemResponse[]` | Yes | Yes | Yes | Unknown | Shipping method snapshot | `CONFIRMED_FROM_CODE` | `OrderShippingItemResponse.java` |
| `payments` | `OrderPaymentResponse[]` | Yes | Yes | Yes | Unknown | Payment records | `CONFIRMED_FROM_CODE` | `OrderPaymentResponse.java` |
| `notes` | `OrderNoteResponse[]` | Yes | Yes | Yes | Unknown | Order notes | `CONFIRMED_FROM_CODE` | `OrderDetailResponse.java` |

## 9. Payment Data Contract

| Field / Area | Type / Shape | Required | Public | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---:|---|---|---|
| Order-level `paymentStatus` | `PaymentStatus` string | Yes | Yes | Yes | Aggregate payment state | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `PaymentStatus.java` |
| Order-level `paymentMethod` | string | No | Yes | Yes | Selected method (`cod`, `bacs`, etc. values need service-level verification) | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `OrderSummaryResponse.java` |
| Payment record `id` | UUID | Yes | Yes | Yes | Payment row id | `CONFIRMED_FROM_CODE` | `OrderPaymentResponse.java` |
| Payment record `status` | string / `PaymentRecordStatus` | Yes | Yes | Yes | Enum values: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED` (verified 2026-05-05) | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/commerce/PaymentRecordStatus.java`, `OrderPaymentResponse.java` |
| Payment record `amount`, `currency`, `paidAt` | decimal/string/instant | Yes/mixed | Yes | Yes | Payment amount snapshot | `CONFIRMED_FROM_CODE` | `OrderPaymentResponse.java` |
| Refund amount/status | `refundAmount`, `refundReason`, `refundedAt`, `paymentStatus=REFUNDED/PARTIALLY_REFUNDED` | Mixed | Yes | Yes | Refund tracked on order and returns | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, `PaymentStatus.java`, `AdminReturnDetailResponse.java` |
| External provider payload/webhook | provider transaction id, bank account id, QR payload, webhook signature | Unknown | No | Internal | SePay/VietQR-specific provider DTO/entity removed from the active system | `NOT_FOUND_IN_REPO` | No confirmed provider DTO/entity audited |

## 10. Shipping / Fulfillment Data Contract

| Area | Fields | Required | Public | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---:|---|---|---|
| Shipping zone | `id`, `name`, `regionCode`, `sortOrder`, `enabled`, `createdAt`, `updatedAt` | Yes/mixed | Checkout options likely | Yes | Service returns map shape | `CONFIRMED_FROM_CODE` | `AdminShippingService.java` |
| Shipping method | `id`, `zoneId`, `methodCode`, `title`, `description`, `cost`, `minOrderAmount`, `freeShippingThreshold`, `sortOrder`, `enabled` | Yes/mixed | Checkout options likely | Yes | Internal shipping methods only | `CONFIRMED_FROM_CODE` | `AdminShippingService.java` |
| Order shipping item | `id`, `methodCode`, `methodTitle`, `amount` | Yes | Yes | Yes | Snapshot saved on order | `CONFIRMED_FROM_CODE` | `OrderShippingItemResponse.java` |
| Fulfillment status | `UNFULFILLED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `RETURNED`, `CANCELLED` | No/nullable | Yes | Yes | Order-level fulfillment state | `CONFIRMED_FROM_CODE` | `FulfillmentStatus.java`, `OrderEntity.java` |
| External carrier integration | GHN/GHTK/ViettelPost provider fields | No | No | No | No provider-specific contract found in audited evidence | `NOT_FOUND_IN_REPO` | `AdminShippingService.java` only confirms internal shipping zones/methods |

## 11. Inventory / Stock Data Contract

| Area | Fields | Required | Public | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---:|---|---|---|
| Product stock state | `stockState` enum | Yes | Yes | Yes | Product-level stock display | `CONFIRMED_FROM_CODE` | `ProductStockState.java`, `Product.java` |
| Product quantity | `stockQuantity` nullable integer | No | Backend domain yes; web contract missing | Yes | Product-level on-hand count | `CONFLICTING_EVIDENCE` | `Product.java`, `public.ts` |
| Variant stock | `variant.stockState`, `variant.stockQuantity`, `variant.isAvailable` | Mixed | Yes | Yes | Variant-level stock | `CONFIRMED_FROM_CODE` | `ProductVariant.java`, `public.ts`, `contracts.js` |
| Admin stock item | `productId`, `productName`, `productSku`, `productImage`, `variantId`, `variantName`, `variantSku`, `stockState`, `quantityOnHand`, `retailPrice` | Yes/mixed | No | Yes | Inventory screen list shape | `CONFIRMED_FROM_CODE` | `AdminStockItemResponse.java` |
| Stock movement | `id`, `movementType`, `quantityDelta`, `quantityBefore`, `quantityAfter`, `referenceType`, `note`, `createdAt`, `serialCount` | Yes/mixed | No | Yes | Movement history with serial count | `CONFIRMED_FROM_CODE` | `StockMovementResponse.java` |
| Serial detail | serial number/status/ownership fields | Unknown | No | Admin maybe | `serialCount` exists; direct serial DTO/entity not audited here | `NEEDS_VERIFICATION` | `StockMovementResponse.java`, backend compile list mentions `StockMovementSerialEntity` |

## 12. Return / Refund Data Contract

| Field / Area | Admin Shape | Customer Shape | Required | Notes | Status | Evidence |
|---|---|---|---:|---|---|---|
| Return header | `id`, `returnNumber`, `orderId`, `customerId`, `orderNumber`, `customerEmail`, `status`, `reason`, `customerNote`, `adminNote`, `refundAmount`, `createdAt`, `updatedAt` | Customer excludes `customerId`, `customerEmail` | Mixed | Admin has extra customer identifiers | `CONFIRMED_FROM_CODE` | `AdminReturnDetailResponse.java`, `CustomerReturnResponse.java` |
| Return item | `id`, `productName`, `variantName`, `sku`, `quantity`, `unitPrice`, `reason` | Same | Mixed | Snapshot return item shape | `CONFIRMED_FROM_CODE` | `AdminReturnDetailResponse.java`, `CustomerReturnResponse.java` |
| Return history | `fromStatus`, `toStatus`, `note`, `createdAt` | Same | Mixed | Status history | `CONFIRMED_FROM_CODE` | `AdminReturnDetailResponse.java`, `CustomerReturnResponse.java` |
| Refund link | `refundAmount`, order `refundAmount/refundReason/refundedAt` | Yes | Mixed | Refund values exist on both return and order | `CONFIRMED_FROM_CODE` | `OrderEntity.java`, return DTOs |
| Return status enum values | string | string | Unknown | Direct enum/value registry not audited; status appears string | `NEEDS_VERIFICATION` | return DTOs |

## 13. Customer Data Contract

| Field / Area | Type / Shape | Public Customer | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---|---|---|
| Customer summary | `id`, `email`, `phone`, `displayName`, `status`, `gender`, `dob` | Yes | Partial | Public profile shape | `CONFIRMED_FROM_CODE` | `CustomerSummary.java` |
| Admin customer detail | `id`, `legacyId`, `email`, `phone`, `displayName`, `firstName`, `lastName`, `status`, `isSynthetic`, `emailVerifiedAt`, `phoneVerifiedAt`, `lastLoginAt`, `createdAt`, `updatedAt`, `addresses`, `orderSummary` | No | Yes | Admin-only operational detail | `CONFIRMED_FROM_CODE` | `AdminCustomerDetailResponse.java` |
| Customer address | `id`, `type`, `fullName`, `phone`, `country`, `province`, `district`, `ward`, `addressLine1`, `addressLine2`, `isDefault` | Yes | Yes via admin detail | No email in customer address response | `CONFIRMED_FROM_CODE` | `CustomerAddressResponse.java` |
| Session/token/csrf shape | cookie/session identifiers, CSRF header | Internal | Internal | OpenAPI and filters indicate cookies/CSRF; never document token values | `NEEDS_VERIFICATION` | OpenAPI/auth docs, security filters in architecture |
| Sensitive handling | email/phone/order history | Own customer only | Admin only | Must not leak other customer data to public endpoints | `NEEDS_VERIFICATION` | Customer DTOs and security architecture |

## 14. Admin User / Role / Permission Data Contract

| Field / Area | Type / Shape | Public | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---|---|---|
| Admin profile | `id`, `fullName`, `email`, `roles`, `permissions`, `status`, `createdAt`, `updatedAt` | No | Yes | Authenticated admin profile | `CONFIRMED_FROM_CODE` | `AdminUserProfile.java` |
| Roles | `List<String>` | No | Yes | Role strings returned in profile | `CONFIRMED_FROM_CODE` | `AdminUserProfile.java` |
| Permissions | `List<String>` | No | Yes | Permission strings returned in profile | `CONFIRMED_FROM_CODE` | `AdminUserProfile.java` |
| Built-in/custom role model | role CRUD fields | No | Yes | Controllers exist but exact role DTO fields not fully audited here | `NEEDS_VERIFICATION` | backend compile list references `AdminRolesController` |
| Admin user status | string | No | Yes | Exact enum values need direct verification | `NEEDS_VERIFICATION` | `AdminUserProfile.java` |

## 15. Media Data Contract

| Field | Type / Shape | Required | Public | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---:|---|---|---|
| `id` | UUID/string | Yes | via `ImageAsset.id` | Yes | Media id | `CONFIRMED_FROM_CODE` | `AdminMediaDetailResponse.java`, `ImageAsset.java` |
| `legacyId` | Long | No | No | Yes | Legacy WP attachment id | `LEGACY_FALLBACK` | `AdminMediaDetailResponse.java` |
| `filePath` | string | Yes/mixed | No | Yes | Storage path | `CONFIRMED_FROM_CODE` | `AdminMediaDetailResponse.java` |
| `publicUrl` | string | Yes/mixed | Yes via image URLs | Yes | Browser-loadable URL | `CONFIRMED_FROM_CODE` | `AdminMediaDetailResponse.java`, `contracts.js` |
| `storageProvider` | string | Yes | No | Yes | e.g. MinIO/S3/local, exact values need verification | `NEEDS_VERIFICATION` | `AdminMediaDetailResponse.java` |
| `mimeType`, `fileSize`, `width`, `height` | string/long/int | Mixed | Yes via image | Yes | Metadata | `CONFIRMED_FROM_CODE` | `AdminMediaDetailResponse.java`, `ImageAsset.java` |
| `altText`, `title`, `caption`, `sizes` | string/text | No | alt via `ImageAsset.alt` | Yes | SEO/accessibility metadata | `CONFIRMED_FROM_CODE` | `AdminMediaDetailResponse.java` |
| `status` | string | Yes/mixed | No | Yes | Exact status values need verification | `NEEDS_VERIFICATION` | `AdminMediaDetailResponse.java` |
| MinIO internal URL fallback | `/media-proxy/...` rewrite | No | Admin browser | Yes | Admin rewrites `http://minio:...` URLs | `LEGACY_FALLBACK` | `bigbike-admin/src/lib/contracts.js` |

## 16. Content / SEO Data Contract

| Domain | Fields | Public Web | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---|---|---|
| Article | `id`, `slug`, `title`, `excerpt`, `body`, `coverImage`, `productImage`, `author`, `category`, `categories`, `tags`, `publishStatus`, `seo`, `publishedAt`, `createdAt`, `updatedAt` | Yes | Yes | Blog/article content | `CONFIRMED_FROM_CODE` | `Article.java`, `public.ts` |
| Page | `id`, `slug`, `title`, `body`, `type`, `publishStatus`, `seo`, `publishedAt`, `createdAt`, `updatedAt` | Yes | Yes | Static content pages | `CONFIRMED_FROM_CODE` | `Page.java`, `public.ts` |
| SEO metadata | `title`, `description`, `canonicalUrl`, `ogImage`, `noIndex` | Yes | Yes | Shared across product/category/brand/content | `CONFIRMED_FROM_CODE` | `SeoMeta.java` |
| Publish status | `PublishStatus` enum | Yes but web subset | Yes but admin subset | See drift section | `CONFLICTING_EVIDENCE` | `PublishStatus.java`, `public.ts`, `contracts.js` |
| Redirect | `sourcePattern`, `targetUrl`, `redirectType`, `statusCode`, `enabled`, `hitCount`, `lastHitAt`, `notes`, `legacyId`, timestamps | Public indirect | Admin | Admin normalizer confirms redirect shape; backend redirect DTO/entity not fully audited here | `NEEDS_VERIFICATION` | `bigbike-admin/src/lib/contracts.js` |

## 17. Settings / Menu / Coupon Data Contract

### Settings

| Field | Type / Shape | Public | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---|---|---|
| `id` | UUID | No | Yes | Admin response only | `CONFIRMED_FROM_CODE` | `AdminSiteSettingResponse.java` |
| `settingKey`, `settingValue`, `settingGroup` | string | Yes | Yes | Public response excludes id/isPublic/description/timestamps | `CONFIRMED_FROM_CODE` | `AdminSiteSettingResponse.java`, `PublicSiteSettingResponse.java` |
| `isPublic` | boolean | No | Yes | Controls public visibility | `CONFIRMED_FROM_CODE` | `AdminSiteSettingResponse.java` |
| `description`, `createdAt`, `updatedAt` | string/instant | No | Yes | Admin metadata | `CONFIRMED_FROM_CODE` | `AdminSiteSettingResponse.java` |

### Menu

| Field | Type / Shape | Public | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---|---|---|
| Menu | `id`, `location`, `name`, `status`, `createdAt`, `updatedAt`, `items` | Public omits id/status/timestamps in `PublicMenu` | Yes | Admin vs public shape differs intentionally | `CONFIRMED_FROM_CODE` | `AdminMenuResponse.java`, `public.ts` |
| Menu item | `id`, `menuId`, `parentId`, `label`, `url`, `targetType`, `targetId`, `sortOrder`, `openInNewTab`, `cssClass`, `status`, timestamps | Public subset | Yes | Public item exposes `parentId`, `label`, `url`, `sortOrder`, `openInNewTab`, `cssClass` | `CONFIRMED_FROM_CODE` | `AdminMenuItemResponse.java`, `public.ts` |

### Coupon

| Field | Type / Shape | Public/Cart | Admin | Notes | Status | Evidence |
|---|---|---:|---:|---|---|---|
| `id`, `legacyId` | UUID/Long | No | Yes | Legacy id from WP/import | `CONFIRMED_FROM_CODE` / `LEGACY_FALLBACK` | `AdminCouponDetailResponse.java` |
| `code` | string | Cart uses `couponCodes` | Yes | Coupon code | `CONFIRMED_FROM_CODE` | `AdminCouponDetailResponse.java`, `CartResponse.java` |
| `name`, `description` | string | No | Yes | Admin metadata | `CONFIRMED_FROM_CODE` | `AdminCouponDetailResponse.java` |
| `discountType`, `amount` | string/decimal | Cart totals effect | Yes | Admin normalizer maps legacy `FIXED_AMOUNT` to `FIXED` | `CONFIRMED_FROM_CODE`; `LEGACY_FALLBACK` | `AdminCouponDetailResponse.java`, `contracts.js` |
| `minimumAmount`, `maximumAmount`, `usageLimit`, `usageCount` | decimal/integer | No direct public | Yes | Usage constraints | `CONFIRMED_FROM_CODE` | `AdminCouponDetailResponse.java` |
| `startsAt`, `expiresAt`, `status`, `metadata`, timestamps | instant/string | No direct public | Yes | Coupon lifecycle | `CONFIRMED_FROM_CODE` | `AdminCouponDetailResponse.java` |

## 18. Enum / Status Registry

| Enum / Status | Values | Used By | Enforcement | Status | Evidence |
|---|---|---|---|---|---|
| `ProductStockState` | `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `PREORDER`, `CONTACT_FOR_STOCK` | Product, variant, inventory, mobile badge | Backend enum + FE/mobile switch | `CONFIRMED_FROM_CODE` | `ProductStockState.java`, `status_badge.dart` |
| `PublishStatus` | `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`, `PENDING`, `PRIVATE`, `TRASH` | Product/content/page | Backend enum; FE/admin subset drift | `CONFLICTING_EVIDENCE` | `PublishStatus.java`, `public.ts`, `contracts.js` |
| `OrderStatus` | `PENDING`, `PROCESSING`, `ON_HOLD`, `COMPLETED`, `CANCELLED`, `REFUNDED`, `FAILED` | Order | Backend enum/string fields; admin/mobile badge | `CONFIRMED_FROM_CODE` | `OrderStatus.java`, `status_badge.dart` |
| `PaymentStatus` | `UNPAID`, `PENDING`, `PAID`, `PARTIALLY_PAID`, `FAILED`, `REFUNDED`, `CANCELLED`, `PARTIALLY_REFUNDED` | Order/payment | Backend enum/string fields; admin normalizer | `CONFIRMED_FROM_CODE` | `PaymentStatus.java`, `contracts.js` |
| `FulfillmentStatus` | `UNFULFILLED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `RETURNED`, `CANCELLED` | Order shipping/fulfillment | Backend enum/string field | `CONFIRMED_FROM_CODE` | `FulfillmentStatus.java` |
| `PageType` | `ABOUT`, `CONTACT`, `POLICY`, `HELP`, `CUSTOM` | Page | Public TS and backend domain type | `CONFIRMED_FROM_CODE` | `public.ts`, `Page.java` |
| `CouponStatus` | `ACTIVE`, `INACTIVE`, `EXPIRED`, `ARCHIVED` | Admin coupon UI | Confirmed in admin contract; backend enum file not audited | `NEEDS_VERIFICATION` | `contracts.js`, `AdminCouponDetailResponse.java` |
| `DiscountType` | `PERCENT`, `FIXED`; legacy `FIXED_AMOUNT` fallback | Coupon | Admin normalizer | `LEGACY_FALLBACK` | `contracts.js` |
| `CustomerStatus` | `ACTIVE`, `DISABLED`, `BLOCKED` | Admin customer UI | Admin normalizer; backend enum not directly audited | `NEEDS_VERIFICATION` | `contracts.js`, `CustomerSummary.java` |
| `CartStatus` | `ACTIVE`, `MERGED`, `ABANDONED`, `CONVERTED`, `EXPIRED` | Cart | Backend enum file confirmed (5 values; `EXPIRED` was missed in 2026-05-04 audit, corrected 2026-05-05) | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/commerce/CartStatus.java`, `CartResponse.java` |
| `PaymentRecordStatus` | `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED` | Payment record | Backend enum file confirmed (5 values; `REFUNDED` was missed in 2026-05-04 audit, corrected 2026-05-05) | `CONFIRMED_FROM_CODE` | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/commerce/PaymentRecordStatus.java`, `OrderPaymentResponse.java` |

## 19. Public vs Admin vs Internal Fields

| Domain | Public Fields | Admin Fields | Internal Fields | Sensitive Fields Handling | Status |
|---|---|---|---|---|---|
| Product | id, sku, slug, name, descriptions, brand/category, media, price, variants, specs, stockState, publishStatus, featured/homepage, rating, ratingCount, contentBottom, seo, timestamps; `rating`/`ratingCount` are cached from approved reviews at runtime | All public plus forceOutOfStock, detailed stock/media/SEO edit fields | legacyId, manageStock, backorders, dimensions, raw flattened media/seo columns | Do not expose legacy/internal stock controls unless intentionally public | `CONFIRMED_FROM_CODE` |
| Order | id, orderNumber, statuses, contact snapshot, totals, lineItems, addresses, shippingItems, payments, notes; `orderKey` only for guest lookup/confirmation path | All order fields plus customer/admin operational context | ipAddress, userAgent, source, channel, fulfillmentType, pendingPaymentExpiresAt | `orderKey`, email/phone/address must be owner/admin only; customer-authenticated detail should not surface `orderKey` | `CONFIRMED_FROM_CODE` |
| Customer | Own id/email/phone/displayName/status/gender/dob, own addresses | legacyId, synthetic flag, verification/login times, order summary | password/session/token/csrf internals | Never expose other customers; no token values in docs | `CONFIRMED_FROM_CODE` |
| Media | URL/alt/width/height/mime via `ImageAsset` | filePath, storageProvider, size, caption, title, sizes, status | provider internals, MinIO internal URL | Public should use public URL, not internal MinIO URL | `CONFIRMED_FROM_CODE` |
| Settings | only `isPublic=true` subset: settingKey/value/group | id, isPublic, description, timestamps | secret config/env values | Secret settings must not be public | `CONFIRMED_FROM_CODE`; secret classification `NEEDS_VERIFICATION` |
| Admin/RBAC | none | admin profile, roles, permissions, statuses | JWT/refresh tokens, password hashes | Do not expose token/password values | `CONFIRMED_FROM_CODE` |

## 20. Known Contract Drift

| Domain | Drift | Current Consumers | Risk | Recommendation | Status | Evidence |
|---|---|---|---|---|---|---|
| Category mobile: missing seo/timestamps | Mobile `Category.fromJson` does not deserialize `seo`, `createdAt`, `updatedAt` fields even though backend emits them | Mobile | Category SEO cannot be used for mobile meta-tags; timestamps not available for cache/display | Update `category.dart` to add `SeoMeta` model and read `seo`, `createdAt`, `updatedAt` | `NOT_FOUND_IN_REPO` (mobile) | `category.dart`, `Category.java` |
| Category mobile: ghost `productCount` field | Mobile `Category` model declares `productCount` field but backend `Category` domain never emits it; always null from API | Mobile | Field always null; dead code risk | Remove `productCount` from `category.dart` or keep it as reserved-for-future field with explicit comment | `MOBILE_ONLY` | `category.dart`, `Category.java` |
| Category request/response `visible` naming asymmetry | Admin POST/PATCH sends `visible: boolean` (UpsertCategoryRequest), but GET response returns `isVisible: boolean` (Category domain). These are different field names. | Admin | Form building and payload construction must use different keys; easy source of bugs when mapping form ↔ payload | Document this asymmetry. Admin FE already handles it correctly in `CategoryDetailScreen.jsx`. Do not rename either side without a migration plan. | `CONFIRMED_FROM_CODE` | `UpsertCategoryRequest.java`, `Category.java`, `CategoryDetailScreen.jsx` |
| Category PATCH seo null does not clear SEO (unlike Product) | For Category PATCH, omitting `seo` leaves SEO unchanged. Product uses `isSeoPresent()` field-tracking so `seo: null` explicitly clears. Category does not have this — to clear Category SEO, send `seo: { title: "", ogImage: null, ... }` (each field explicitly empty). | Admin | Admin FE that omits `seo` when all fields are blank cannot clear category SEO; must always send `seo` object on update | FE `toPayload` should always send `seo` object (Phase 2 fix already does this). Future: add `isSeoPresent()` tracking to `UpsertCategoryRequest` for full parity with Product. | `CONFIRMED_FROM_CODE` | `AdminCatalogMutationService.java:1081-1085`, `UpsertCategoryRequest.java` vs `UpsertProductRequest.java` |
| Product publish status | Backend enum has `PENDING`, `PRIVATE`, `TRASH`; web type only has `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED`; admin has `TRASH` but misses `PENDING`, `PRIVATE` | Web/admin | Unknown status may render as invalid/UNKNOWN or break filters | Generate shared enum package or update FE/admin contracts to backend enum | `CONFLICTING_EVIDENCE` | `PublishStatus.java`, `public.ts`, `contracts.js` |
| Product stock quantity | Backend domain `Product` has product-level `stockQuantity`; public web `Product` type omits it | Public web | Product pages cannot reliably render product-level quantity if needed | Add optional `stockQuantity?: number | null` to public contract if API returns it | `CONFLICTING_EVIDENCE` | `Product.java`, `public.ts` |
| Product force out of stock | Backend domain has `forceOutOfStock`; public web type omits it | Public web/admin | Public UI may not understand forced-out-of-stock state beyond `stockState` | Keep backend as authority; expose only if UX needs explicit flag | `CONFLICTING_EVIDENCE` | `Product.java`, `public.ts` |
| Variant option/spec fallback | Admin accepts `optionName/optionValue`, `specValue`, `groupName` in addition to canonical `name/value/group` | Admin | Hidden legacy payloads keep working but contract is fuzzy | Document fallback as legacy only; new API should emit canonical names | `LEGACY_FALLBACK` | `contracts.js` |
| Order list/detail naming | Backend uses `status`, `lineItems`, `subtotalAmount`, `shippingAmount`, `discountAmount`, `totalAmount`; admin normalizes to `orderStatus`, `items`, `subtotal`, `shippingFee`, `discount`, `total` | Admin | UI code may depend on transformed names and drift from backend | Keep backend canonical; admin view model can transform but must not be reused as API contract | `CONFLICTING_EVIDENCE` | `OrderDetailResponse.java`, `contracts.js` |
| Order customerName | Backend has `customerEmail/customerPhone`, admin derives `customerName` from email/phone | Admin | Display name is not real data | Treat `customerName` as derived UI-only | `FRONTEND_ONLY` | `contracts.js`, `OrderEntity.java` |
| Payment method | Admin derives `paymentMethod` from first payment record if not present | Admin | Multiple payment records could make first-record assumption wrong | Prefer order-level `paymentMethod` or explicit primary payment field | `NEEDS_VERIFICATION` | `contracts.js`, `OrderEntity.java`, `OrderPaymentResponse.java` |
| Media filename/publicUrl | Admin maps `filename` from `filePath` and `publicUrl` from `url` fallback | Admin | UI may show path as filename | Add explicit filename in backend response if required | `LEGACY_FALLBACK` | `contracts.js`, `AdminMediaDetailResponse.java` |
| Coupon legacy fields | Admin maps `FIXED_AMOUNT` to `FIXED`, `discountValue` to `amount`, `minimumOrderAmount` to `minimumAmount`, `maxUsage` to `usageLimit` | Admin/mock | Mock/legacy naming can leak into production code | Keep canonical backend fields in docs and tests | `LEGACY_FALLBACK` | `contracts.js`, `AdminCouponDetailResponse.java` |
| Settings key/value fallback | Admin accepts `key/value` and `settingKey/settingValue` | Admin | UI ambiguity | Backend canonical is `settingKey/settingValue` | `LEGACY_FALLBACK` | `contracts.js`, `AdminSiteSettingResponse.java` |
| MinIO URL rewrite | Admin rewrites `http://minio:PORT/...` to `/media-proxy/...` | Admin browser | Broken images if public URL is internal-only | Backend should emit browser-safe `publicUrl`; keep rewrite as safety net only | `LEGACY_FALLBACK` | `contracts.js` |

## 21. Validation Contract

| Domain | Field / Rule | Backend Validation | Frontend Validation | Status | Evidence |
|---|---|---|---|---|---|
| Category | `slug` regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` | `@Pattern` | Admin `createCategorySchema` Zod validates slug format | `CONFIRMED_FROM_CODE` | `UpsertCategoryRequest.java`, `schemas.js` |
| Category | `name` max 255 | `@Size(max=255)` | Admin Zod schema validates min 1 | `CONFIRMED_FROM_CODE` | `UpsertCategoryRequest.java`, `schemas.js` |
| Category | `description` max 5000 | `@Size(max=5000)` | No FE length limit currently | `CONFIRMED_FROM_CODE` | `UpsertCategoryRequest.java` |
| Category | `parentId` max 64 | `@Size(max=64)` | FE sends ID from select or `""` to clear | `CONFIRMED_FROM_CODE` | `UpsertCategoryRequest.java` |
| Category | `seo.title` max 255 | `@Size(max=255)` | Admin Zod validates | `CONFIRMED_FROM_CODE` | `SeoMetaRequest.java`, `schemas.js` |
| Category | `seo.description` max 5000 | `@Size(max=5000)` | Admin Zod validates | `CONFIRMED_FROM_CODE` | `SeoMetaRequest.java`, `schemas.js` |
| Category | `seo.canonicalUrl` max 2048 | `@Size(max=2048)` | Admin Zod validates URL format | `CONFIRMED_FROM_CODE` | `SeoMetaRequest.java`, `schemas.js` |
| Category | hide / soft-delete visibility guard | 409 CONFLICT if visible children exist | Admin displays toast on `error.code === 'CONFLICT'` | `CONFIRMED_FROM_CODE` | `AdminCatalogMutationService.java`, `CategoryDetailScreen.jsx` |
| Category | `sortOrder` integer | none on BE | Admin Zod validates non-negative integer | `CONFIRMED_FROM_CODE` | `UpsertCategoryRequest.java`, `schemas.js` |
| Product | `sku` max 100 | `@Size(max=100)` | Admin normalizer trims/normalizes | `CONFIRMED_FROM_CODE` | `UpsertProductRequest.java`, `contracts.js` |
| Product | `slug` max 200 and regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` | `@Size`, `@Pattern` | FE should mirror for UX only | `CONFIRMED_FROM_CODE` | `UpsertProductRequest.java` |
| Product | `name` max 255 | `@Size(max=255)` | Admin should validate | `CONFIRMED_FROM_CODE` | `UpsertProductRequest.java` |
| Product | `shortDescription` max 2000, `description` max 20000, `contentBottom` max 50000 | `@Size` | Admin rich editor should respect | `CONFIRMED_FROM_CODE` | `UpsertProductRequest.java` |
| Product | `currency` must be `VND` | `@Pattern("^(VND)$")` | Web/admin type uses VND | `CONFIRMED_FROM_CODE` | `UpsertProductRequest.java`, `public.ts` |
| Product media | Gallery max 50, videos max 20, specs max 100, variants max 200 | `@Size` on request lists | Admin should prevent over-limit | `CONFIRMED_FROM_CODE` | `UpsertProductRequest.java` |
| Checkout | `billingAddress` required | `@NotNull @Valid` | Checkout UI should require billing info | `CONFIRMED_FROM_CODE` | `CheckoutRequest.java` |
| Checkout | `paymentMethod` required | `@NotBlank` | Checkout UI should require selected payment method | `CONFIRMED_FROM_CODE` | `CheckoutRequest.java` |
| Cart/order/stock | Quantity/stock/price validation | Service-level validation implied by architecture and DTOs; exact rules need service audit | UI should not be source of truth | `NEEDS_VERIFICATION` | `CheckoutService.java` path, architecture docs |
| Customer/session | CSRF/session protection | Security filters and OpenAPI mention cookies/CSRF | Web/mobile should send CSRF where required | `NEEDS_VERIFICATION` | architecture docs, OpenAPI |

## 22. Missing / Needs Verification Data Contracts

- ~~`CartStatus` enum values~~: confirmed in `CartStatus.java` (`ACTIVE`, `MERGED`, `ABANDONED`, `CONVERTED`, `EXPIRED`) — initially listed as 4 values in 2026-05-04 audit; `EXPIRED` was missing and added during 2026-05-05 re-verification.
- ~~`PaymentRecordStatus` enum values~~: confirmed in `PaymentRecordStatus.java` (`PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `REFUNDED`) — initially listed as 4 values in 2026-05-04 audit; `REFUNDED` was missing and added during 2026-05-05 re-verification.
- Return status enum/allowed transitions: return DTOs use string; direct status enum or transition service needs audit.
- Full role/permission entity/request/response contracts: admin profile confirmed, role CRUD field shape needs deeper audit.
- Admin review moderation exact response shape still needs deeper audit; public review pagination + aggregate response is confirmed.
- Report metric semantics: report/dashboard controllers exist, but metric formula/data contract needs service audit.
- Notification data contract: notification hooks exist in architecture, but persisted notification entity or public/admin notification DTO not confirmed.
- External payment provider/webhook shape: not found in audited evidence.
- External carrier/shipping provider shape: not found in audited evidence.
- Mobile model scope: mobile status badge confirms order/stock status consumption; full Dart models/contracts need deeper audit.
- Sensitive settings classification: `isPublic` exists, but exact allowlist/denylist for settings keys needs verification.

## 23. Evidence Summary

| Area | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Architecture | `docs/engineering/ARCHITECTURE.md` | Repo boundaries, apps/services/data layers, source-of-truth expectations | High |
| Product persistence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/ProductEntity.java` | Product DB/entity fields and nullable hints | High |
| Product domain | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/Product.java` | Public/application product shape | High |
| Product admin request | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/UpsertProductRequest.java` | Admin writable fields and validation limits | High |
| Catalog common shapes | `ImageAsset.java`, `ProductPrice.java`, `ProductVariant.java`, `ProductSpecification.java`, `SeoMeta.java` | Nested canonical shapes | High |
| Catalog enums | `ProductStockState.java`, `PublishStatus.java` | Stock/publish values | High |
| Category/Brand | `Category.java`, `Brand.java` | Category/brand domain fields | High |
| Order persistence | `persistence/entity/commerce/order/OrderEntity.java` | Order stored fields/internal fields | High |
| Order customer DTOs | `api/order/dto/OrderDetailResponse.java`, `OrderLineItemResponse.java`, `OrderAddressResponse.java`, `OrderPaymentResponse.java`, `OrderShippingItemResponse.java` | Customer/order response shapes | High |
| Order enums | `OrderStatus.java`, `PaymentStatus.java`, `FulfillmentStatus.java` | Status registry | High |
| Cart/Checkout | `CartResponse.java`, `CartItemResponse.java`, `CartTotalsResponse.java`, `CheckoutRequest.java`, `CheckoutAddressRequest.java`, `OrderSummaryResponse.java` | Cart/checkout data shapes | High |
| Customer | `CustomerSummary.java`, `CustomerAddressResponse.java`, `AdminCustomerDetailResponse.java` | Public/admin customer fields | High |
| Media | `AdminMediaDetailResponse.java`, `ImageAsset.java` | Media metadata/public image shape | High |
| Content/SEO | `Article.java`, `Page.java`, `SeoMeta.java` | Article/page/SEO shape | High |
| Settings/Menu/Coupon | `AdminSiteSettingResponse.java`, `PublicSiteSettingResponse.java`, `AdminMenuResponse.java`, `AdminMenuItemResponse.java`, `AdminCouponDetailResponse.java` | Operational config/menu/coupon data | High |
| Inventory | `AdminStockItemResponse.java`, `StockMovementResponse.java` | Admin stock and movement shape | High |
| Return | `AdminReturnDetailResponse.java`, `CustomerReturnResponse.java` | Return/refund response shape | High |
| Web consumer contracts | `bigbike-web/lib/contracts/public.ts` | Public web TypeScript contracts and enum subset | High |
| Admin consumer contracts | `bigbike-admin/src/lib/contracts.js` | Admin normalization, legacy fallbacks, drift | High |
| Mobile status consumer | `bigbike_mobile/lib/core/widgets/status_badge.dart` | Mobile consumes order and stock status values | Medium |

## 24. Relationship With Other Docs

- `ARCHITECTURE.md`: mô tả hệ thống được thiết kế kỹ thuật như thế nào. File này chỉ dùng architecture làm context, không thay thế architecture.
- `API_CONTRACT.md`: nên mô tả endpoint nhận/trả dữ liệu. File này chỉ mô tả canonical data shape và ownership.
- `BUSINESS_RULES.md`: mô tả luật nghiệp vụ bắt buộc. File này chỉ ghi field/status và visibility, không quyết định rule.
- `STATE_MACHINES.md`: mô tả state transition hợp lệ. File này chỉ liệt kê enum/status có evidence.
- `PERMISSION_MATRIX.md`: nên mô tả ai được làm gì. File này chỉ phân public/admin/internal fields.
- `TRACEABILITY_MATRIX.md`: nên nối requirement -> module -> API -> test. File này cung cấp input data-domain cho traceability.

## Audit Notes

- Chỉ đọc/inspect repo qua GitHub source evidence.
- Không chạy migration.
- Không chạy build/test/deploy.
- Không sửa code application.
- Không refactor.
- Không implement feature mới.
- Không đưa secret/token/password/private key/env value vào tài liệu.

## Post-Audit Summary

### Files created/updated

| File | Action |
|---|---|
| `docs/engineering/DATA_CONTRACT.md` | Created |

### Domain data contracts documented

Product, Category, Brand, Cart, Checkout, Order, Payment, Shipping/Fulfillment, Inventory/Stock, Return/Refund, Customer, Admin User/Role/Permission, Media, Content/SEO, Settings, Menu, Coupon, Review, Report, Notification.

### CONFIRMED_FROM_CODE highlights

- Product: `ProductEntity`, `Product`, `UpsertProductRequest`, `ProductPrice`, `ImageAsset`, `ProductVariant`, `ProductSpecification`, `SeoMeta`.
- Catalog enums: `ProductStockState`, `PublishStatus`.
- Order: `OrderEntity`, `OrderDetailResponse`, `OrderLineItemResponse`, `OrderAddressResponse`, `OrderPaymentResponse`, `OrderShippingItemResponse`.
- Commerce enums: `OrderStatus`, `PaymentStatus`, `FulfillmentStatus`.
- Cart/checkout: `CartResponse`, `CartItemResponse`, `CartTotalsResponse`, `CheckoutRequest`, `CheckoutAddressRequest`, `OrderSummaryResponse`.
- Customer: `CustomerSummary`, `CustomerAddressResponse`, `AdminCustomerDetailResponse`.
- Media: `AdminMediaDetailResponse`, `ImageAsset`.
- Content: `Article`, `Page`, `SeoMeta`.
- Settings/menu/coupon: admin/public setting DTOs, menu DTOs, coupon detail DTO.
- Inventory/return: stock item/movement DTOs, admin/customer return DTOs.

### BACKEND_ONLY / FRONTEND_ONLY / MOBILE_ONLY

| Label | Items |
|---|---|
| `BACKEND_ONLY` | Product `legacyId`, `tags`, `manageStock`, `backorders`, dimensions, order `ipAddress`, `userAgent`, `source`, `channel`, `fulfillmentType` |
| `FRONTEND_ONLY` | Admin derived `customerName`, admin view-model fields `items/subtotal/shippingFee/discount/total`, admin `filename` fallback from `filePath` |
| `MOBILE_ONLY` | No mobile-only canonical field confirmed. Mobile status badge consumes backend order/stock enum values. |

### Contract drift

- Backend `PublishStatus` is wider than web/admin enum contracts.
- Backend product `stockQuantity` exists in domain but web `Product` type omits product-level field.
- Backend `forceOutOfStock` exists in domain/entity but public web type omits it.
- Backend order fields are transformed heavily by admin normalizer (`status` -> `orderStatus`, `lineItems` -> `items`, amount suffix fields -> shorter UI names).
- Admin derives `customerName` instead of consuming a backend field.
- Admin has multiple legacy/mock fallbacks for coupon/media/settings/variant/spec fields.

### NEEDS_VERIFICATION

- Return status values.
- (`CartStatus` and `PaymentRecordStatus` were resolved to `CONFIRMED_FROM_CODE` in 2026-05-05 re-verification — see Section 18.)
- Full role/permission CRUD data shape.
- Admin review moderation detailed shape.
- Report metric semantics.
- Persisted notification data contract.
- External payment provider/webhook data.
- External carrier/shipping provider data.
- Full mobile data models and API mapping.
- Sensitive settings key classification.
