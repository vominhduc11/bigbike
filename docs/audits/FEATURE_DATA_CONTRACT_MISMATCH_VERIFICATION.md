# Feature / Data Contract Mismatch — Verification Report

**Ngày audit:** 2026-05-13
**Phạm vi:** 6 mismatch giữa backend ↔ admin / web / mobile (Issues 1–6)
**Phương pháp:** đọc source thật (không sửa code trước), trace từ domain record backend → mapper → contract client → form.

## Tóm tắt

| ID | Vấn đề | Status | Risk |
|---|---|---|---|
| #1 | Admin CMS Content normalizer làm rơi hero/author/category/parent fields | **CONFIRMED** | **P1** |
| #2 | Mobile product `image` / `gallery` parser lệch shape backend | **CONFIRMED** | **P0** |
| #3 | Customer status `PENDING` có ở backend nhưng admin map về `UNKNOWN` | **CONFIRMED** | **P1** |
| #4 | Brand `bannerImage` có ở backend + web render, admin không quản lý | **CONFIRMED** | **P1** |
| #5 | Product `stockQuantity` / `forceOutOfStock` lệch type giữa backend ↔ web/admin/mobile | **CONFIRMED** | **P2** |
| #6 | Mobile `StockState.fromString()` fallback unknown → `inStock` cho phép `canAddToCart` | **CONFIRMED** | **P1** |

Không có issue nào ở trạng thái NOT_FOUND, INTENTIONAL, hoặc NEEDS_BUSINESS_DECISION. Tất cả đều thuộc nhóm fix code an toàn (backward-compatible parser/normalizer + thêm field), không cần xác nhận business.

---

## #1 — Admin Content Normalizer rơi hero/author/category/parent

**Status:** CONFIRMED — **P1**

### Evidence

- Backend record [AdminContentItem.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/content/AdminContentItem.java#L9-L35) liệt kê đầy đủ: `authorId`, `categoryId`, `parentId`, `heroImage`, `heroTitle`, `heroDescription`, `heroKicker`.
- [AdminContentReadService.fromPage()](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminContentReadService.java#L118-L146) map đầy đủ hero/parentId. `fromArticle()` map authorId, categoryId.
- [bigbike-admin/src/lib/contracts.js — `normalizeContentItem()`](../../bigbike-admin/src/lib/contracts.js#L313-L351) **không preserve**: `authorId`, `categoryId`, `parentId`, `heroImage`, `heroTitle`, `heroDescription`, `heroKicker`. Chỉ giữ object `author` / `category` (nested), không giữ id phẳng.
- Form đọc: [ContentDetailScreen.jsx `buildFormFromItem`](../../bigbike-admin/src/screens/ContentDetailScreen.jsx#L58-L88) đọc `item.authorId`, `item.categoryId`, `item.parentId`, `item.heroImage?.url`, `item.heroTitle`, … sau khi đã đi qua `normalizeContentItem`. Vì các field này bị normalizer bỏ → form luôn empty.
- Khi save, [toPayload()](../../bigbike-admin/src/screens/ContentDetailScreen.jsx#L99-L156) **luôn gửi** các field này (comment `P1-001: Always emit fields that can be cleared`) → backend nhận empty và clear data.

**Hậu quả:** mở 1 page có hero hoặc article có author/category, không sửa gì, bấm Save → bị clear hero/author/category/parent ở DB.

### Recommended fix

Sửa `normalizeContentItem()` để preserve các field phẳng. Vẫn giữ `author` / `category` object như cũ (backward-compatible). Backward-compat: với data cũ không có `authorId`/`categoryId` phẳng, fallback lấy từ `author?.id` / `category?.id`.

### Files cần sửa

- `bigbike-admin/src/lib/contracts.js` → `normalizeContentItem()`

### Test cần chạy

- `npm run lint` + `npm run build` ở `bigbike-admin/`.
- Manual smoke: mở 1 page có hero, không sửa, save → hero không bị mất.

---

## #2 — Mobile Product media parser lệch shape

**Status:** CONFIRMED — **P0** (crash app khi mở product list/detail)

### Evidence

- Backend trả `image` là object `ImageAsset` và `gallery` là `List<ImageAsset>` ([Product.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/Product.java#L16-L17), [ImageAsset.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ImageAsset.java)).
- [product.dart `ProductSummary.fromJson`](../../bigbike_mobile/lib/core/models/product.dart#L131): `image: j['image'] as String?` → khi backend trả Map, `as String?` returns null (Dart trả null cho `Map as String?` không phải String). Hậu quả: tất cả product summary mất ảnh.
- [product.dart `Product.fromJson`](../../bigbike_mobile/lib/core/models/product.dart#L192): `gallery: (j['gallery'] as List? ?? []).cast<String>()` → **TypeError tại runtime** khi từng item là Map (cast<String> reject `Map<String, dynamic>`). Mở PDP → crash.
- [ProductVariant.fromJson](../../bigbike_mobile/lib/core/models/product.dart#L64-L79) đã có nhánh xử lý cả `Map` và `String` cho `image` → tham chiếu pattern cần áp dụng cho ProductSummary/Product.

### Recommended fix

Tạo helper `_imageUrlFromJson(dynamic)` parse cả 2 shape:
- `Map` → đọc `url`.
- `String` (legacy / mock) → dùng nguyên.
- Khác → `null`.

Áp dụng cho:
- `ProductSummary.image`
- `Product.gallery` (map từng item qua helper, filter null).

Không cast cứng `.cast<String>()`. Không crash khi backend bổ sung field mới.

### Files cần sửa

- `bigbike_mobile/lib/core/models/product.dart` (chỉ file model, không đổi UI).

### Test cần chạy

- `flutter analyze`
- `flutter test` (nếu có test cho product model — kiểm tra).

---

## #3 — Customer status PENDING bị map về UNKNOWN

**Status:** CONFIRMED — **P1**

### Evidence

- Backend [CustomerStatus.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/customer/CustomerStatus.java) enum: `ACTIVE, DISABLED, PENDING, BLOCKED`. Comment ghi rõ source-of-truth.
- Admin [contracts.js L508-L511](../../bigbike-admin/src/lib/contracts.js#L508-L511):
  ```js
  export const CUSTOMER_STATUS_VALUES = ['ACTIVE', 'DISABLED', 'BLOCKED']
  // normalizeCustomerStatus → 'UNKNOWN' khi không match
  ```
  → khách hàng PENDING hiển thị "Không rõ".
- [CustomerListScreen.jsx L12](../../bigbike-admin/src/screens/CustomerListScreen.jsx#L12): `STATUS_TONES = { ACTIVE, DISABLED, BLOCKED, UNKNOWN }` — thiếu PENDING.
- [CustomerListScreen.jsx L104-L107](../../bigbike-admin/src/screens/CustomerListScreen.jsx#L104-L107): filter dropdown thiếu PENDING.
- [vi.json `status.customer` L247-L252](../../bigbike-admin/src/locales/vi.json#L247-L252): thiếu key `PENDING` (en.json cũng vậy).

### Recommended fix

- `CUSTOMER_STATUS_VALUES` thêm `'PENDING'`.
- `STATUS_TONES`: PENDING → `warning` (giống DISABLED) hoặc `info` (tone trung lập). Recommended `warning` vì PENDING cần action.
- Dropdown filter thêm option PENDING.
- i18n vi/en thêm label PENDING (vi: "Chờ duyệt"; en: "Pending").

### Files cần sửa

- `bigbike-admin/src/lib/contracts.js`
- `bigbike-admin/src/screens/CustomerListScreen.jsx`
- `bigbike-admin/src/locales/vi.json`
- `bigbike-admin/src/locales/en.json`

### Test cần chạy

- `npm run lint` + `npm run build` ở `bigbike-admin/`.

---

## #4 — Brand banner không quản lý được ở admin

**Status:** CONFIRMED — **P1**
(Đã xác nhận banner ĐANG được web render → không phải NEEDS_BUSINESS_DECISION.)

### Evidence

- Backend [Brand.java L11](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/Brand.java#L11): `ImageAsset bannerImage`.
- Backend [UpsertBrandRequest.java L24](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/UpsertBrandRequest.java#L23-L24): `private ImageAssetRequest banner;` — admin API accept update.
- Web [public.ts L220](../../bigbike-web/lib/contracts/public.ts#L220): `bannerImage?: ImageAsset` (đã có type).
- Web [brands/[slug]/page.tsx L213, L224](../../bigbike-web/app/brands/[slug]/page.tsx#L213-L224): render `brand.bannerImage ?? brand.logo` → **banner đã được dùng**.
- Admin [contracts.js `normalizeBrand()` L295-L311](../../bigbike-admin/src/lib/contracts.js#L295-L311): **KHÔNG** preserve `bannerImage`.
- Admin [BrandDetailScreen.jsx](../../bigbike-admin/src/screens/BrandDetailScreen.jsx): không có field/UI nào quản lý banner. Form chỉ có logo.

**Hậu quả:** Banner là field chính trên trang brand chi tiết web, nhưng người quản lý không có cách upload/sửa qua admin UI — chỉ có thể qua DB hoặc API trực tiếp.

### Recommended fix

1. `normalizeBrand()`: thêm `bannerImage: normalizeImageAsset(source.bannerImage)`.
2. `BrandDetailScreen.jsx`:
   - `buildEmptyForm()` thêm `bannerUrl: ''`, `bannerAlt: ''`.
   - `buildFormFromItem()` đọc `item.bannerImage?.url` / `.alt`.
   - Form section "Media" thêm `<ImageUrlInput>` cho banner (sau logo).
   - `toPayload()` luôn gửi `banner` (giống cách logo gửi): `{ url: '' }` khi empty để cho phép clear.

### Files cần sửa

- `bigbike-admin/src/lib/contracts.js` → `normalizeBrand()`
- `bigbike-admin/src/screens/BrandDetailScreen.jsx` → form
- (Optional) `bigbike-admin/src/locales/vi.json` + `en.json` → key `brands.detail.bannerUrl` / `bannerAlt`. Có thể dùng `defaultValue` để khỏi block UI nếu chưa có translation.

### Test cần chạy

- `npm run lint` + `npm run build` ở `bigbike-admin/`.
- Manual smoke: edit brand, set banner URL, save, reload → banner persist và web render.

---

## #5 — Product stockQuantity / forceOutOfStock type drift

**Status:** CONFIRMED — **P2** (type-level; buy-box runtime không bị vì dùng snapshot endpoint riêng)

### Evidence

- Backend [Product.java L24-L25](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/Product.java#L24-L25): `Integer stockQuantity`, `Boolean forceOutOfStock`.
- Backend serialize 2 field này trên public `/api/v1/products/{id}` (no DTO filter — record direct).
- Backend [CatalogController L132-L133](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/catalog/CatalogController.java#L132-L133): snapshot endpoint cũng đọc cả 2 field.
- Web [public.ts L162-L196](../../bigbike-web/lib/contracts/public.ts#L162-L196) `Product` type: **thiếu** `stockQuantity` và `forceOutOfStock` (chỉ `ProductVariant` có `stockQuantity`).
- Web [stock/route.ts L42](../../bigbike-web/app/api/products/[id]/stock/route.ts#L42): truy cập `product.forceOutOfStock` qua `Record<string, unknown>` (workaround vì type contract thiếu).
- Admin [contracts.js `normalizeProduct()` L223-L271](../../bigbike-admin/src/lib/contracts.js#L223-L271): có `forceOutOfStock` (L262), **thiếu** product-level `stockQuantity` (chỉ variant có).
- Mobile [product.dart](../../bigbike_mobile/lib/core/models/product.dart): Product và ProductSummary đều không có 2 field này.

**Hậu quả:** Type contract không phản ánh API thật. Khi viết code mới truy cập 2 field này, dev phải cast hoặc bỏ qua type-check. Buy-box hiện hoạt động đúng nhờ snapshot endpoint trả riêng, nên không phải hotfix.

### Recommended fix

Theo nguyên tắc backward-compatible:
- Web `public.ts` → `Product` thêm:
  - `stockQuantity?: number | null;`
  - `forceOutOfStock?: boolean | null;`
- Admin `normalizeProduct()` → thêm:
  - `stockQuantity: Number.isFinite(source.stockQuantity) ? Number(source.stockQuantity) : null,`
- Mobile: optional, có thể thêm nullable field vào model nếu UI cần. Để giảm scope risk → **để Mobile cho fix sau** trừ khi UI cần.

Không đổi behavior của buy-box (snapshot endpoint vẫn chạy).

### Files cần sửa

- `bigbike-web/lib/contracts/public.ts`
- `bigbike-admin/src/lib/contracts.js`
- (Mobile defer trừ khi yêu cầu)

### Test cần chạy

- `npm run typecheck` (hoặc `tsc --noEmit`) + `npm run build` ở `bigbike-web/`.
- `npm run lint` + `npm run build` ở `bigbike-admin/`.

---

## #6 — Mobile StockState fallback unknown → inStock

**Status:** CONFIRMED — **P1** (safety, không phải bug hiện tại nhưng dễ regress khi backend thêm state)

### Evidence

- Mobile [product.dart L12-L19](../../bigbike_mobile/lib/core/models/product.dart#L12-L19):
  ```dart
  static StockState fromString(String? s) => switch (s) {
    'IN_STOCK' => inStock,
    'LOW_STOCK' => lowStock,
    'OUT_OF_STOCK' => outOfStock,
    'PREORDER' => preorder,
    'CONTACT_FOR_STOCK' => contactForStock,
    _ => inStock,  // ← unsafe
  };
  ```
- [product.dart L29-L30](../../bigbike_mobile/lib/core/models/product.dart#L29-L30): `canAddToCart` true cho `inStock` → khi backend trả string lạ (vd typo, state mới), mobile cho phép mua.
- Backend chỉ định nghĩa `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK` ở [ProductStockState.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ProductStockState.java) (chú ý: mobile có thêm `PREORDER`, `CONTACT_FOR_STOCK` ngoài enum backend — đây là dấu hiệu mismatch riêng nhưng không nguy hiểm vì fromString chỉ map khi backend trả đúng các string đó).

### Recommended fix

Thêm sentinel `unknown` vào enum, fallback về đó, `canAddToCart` trả false:

```dart
enum StockState {
  inStock, lowStock, outOfStock, preorder, contactForStock, unknown;

  static StockState fromString(String? s) => switch (s) {
    'IN_STOCK' => inStock,
    'LOW_STOCK' => lowStock,
    'OUT_OF_STOCK' => outOfStock,
    'PREORDER' => preorder,
    'CONTACT_FOR_STOCK' => contactForStock,
    _ => unknown,
  };

  String get label => switch (this) {
    inStock => 'Còn hàng',
    lowStock => 'Sắp hết',
    outOfStock => 'Hết hàng',
    preorder => 'Đặt trước',
    contactForStock => 'Liên hệ',
    unknown => 'Không rõ',
  };

  bool get canAddToCart => this == inStock || this == lowStock || this == preorder;
}
```

Cách này safe-by-default: chỉ cho mua khi backend trả state đã biết và state đó cho phép mua.

### Files cần sửa

- `bigbike_mobile/lib/core/models/product.dart`

### Test cần chạy

- `flutter analyze`
- `flutter test`

---

## Plan thực thi fix (sau report)

Thứ tự fix theo risk + impact:

1. **#2 (P0 mobile crash)** — `bigbike_mobile/lib/core/models/product.dart` — fix image/gallery parser.
2. **#6 (P1 mobile safety)** — cùng file, gộp commit/PR với #2 để mobile chỉ chạy CI 1 lần.
3. **#1 (P1 content data loss)** — `bigbike-admin/src/lib/contracts.js` `normalizeContentItem()`.
4. **#3 (P1 customer status)** — `bigbike-admin` contracts + screen + locales.
5. **#4 (P1 brand banner)** — `bigbike-admin` contracts + screen.
6. **#5 (P2 type drift)** — `bigbike-web/lib/contracts/public.ts` + `bigbike-admin` normalizeProduct.

Tất cả fix client-side, không đổi API/DB. Backward-compatible với legacy WordPress data.
