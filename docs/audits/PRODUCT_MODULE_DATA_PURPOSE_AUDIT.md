# Product Module Data Purpose Audit

**Date:** 2026-05-10  
**Auditor:** Senior System Analyst + Senior Fullstack Engineer  
**Scope:** bigbike-admin, bigbike-backend, bigbike-web — Product Module

---

## Executive Summary

**Module sản phẩm hiện tại đã đủ dữ liệu hiển thị website chưa?**  
Về cơ bản đủ. Các field cốt lõi (name, slug, price, image, gallery, variants, specs, videos, SEO, contentBottom, rating) đều có đường truyền đầy đủ từ Admin → Backend → Web. Website render được đầy đủ PDP, listing, homepage carousel và breadcrumb.

**Đã đủ dữ liệu nội bộ/vận hành chưa?**  
Phần lớn đủ. Tuy nhiên, có một số field trong DB chưa có UI quản lý trong Admin (trackSerials, manageStock, backorders, dimensions, discountPercentOverride, legacyId), tạo thành dead weight hoặc phụ thuộc vào quá trình migration từ WP.

**Có field vô dụng hoặc không rõ mục đích không?**  
Có. Các field `discountPercentOverride`, `manageStock`, `backorders`, `weightKg/lengthCm/widthCm/heightCm` tồn tại trong DB entity nhưng không có UI admin, không được expose trong DTO, không được render ở web. Là dead weight từ schema WooCommerce migration.

**Có mismatch data contract giữa admin/backend/web không?**  
Có 3 mismatch đáng chú ý:
1. **Variant price**: Backend DTO `VariantRequest` có fields `retailPrice/compareAtPrice/salePrice` nhưng Admin UI đã xoá input này (comment: "variant price fields intentionally omitted"). Backend có thể nhận nhưng Admin không gửi. Web không render variant price riêng — dùng product-level price.
2. **Spec field name**: Admin gửi `groupName`, Backend DTO nhận `groupName`, nhưng domain record dùng `group` → web `ProductSpecification.group`. Mapping đúng (trong service layer), nhưng tên không thống nhất cross-layer.
3. **Variant gallery alt**: Admin không có input cho `alt` của gallery image trong variant (chỉ có `url`), dù backend DTO `GalleryImageRequest` có field `alt`.

**Có rủi ro launch không?**  
Không có P0 hard-blocker. Vấn đề nghiêm trọng nhất là `filter_gender` bị reject bởi backend (`CatalogController.java:67`) dù web gửi param này, nhưng web đang gửi giá trị từ URL param, backend throws `ValidationException` — nếu user nhập `filter_gender` vào URL thì trang trả về error state. Đây là P1.

---

## Field Inventory

| Field | Nơi xuất hiện (file:line) | Loại dữ liệu | Admin UI có quản lý? | Backend có lưu/xử lý? | Website có render? | Mục đích business | Trạng thái | Ghi chú |
|---|---|---|---|---|---|---|---|---|
| id | ProductEntity.java:29, Product.java:7, public.ts:163 | System Data | Không (auto-generated) | Có | Có (key, links) | Primary key | Hoàn chỉnh | |
| legacyId | ProductEntity.java:31 | Technical | Không | Có (DB chỉ) | Không | WordPress migration ID | Suspicious | Không expose qua DTO, không xoá được để backward compat |
| sku | ProductDetailScreen.jsx:324, UpsertProductRequest.java:16, ProductEntity.java:34, Product.java:8, public.ts:164 | Operational Data | Có | Có | Không render (chỉ admin list) | Mã kho | Hoàn chỉnh | SKU không render trên web PDP |
| slug | ProductDetailScreen.jsx:326, UpsertProductRequest.java:21, ProductEntity.java:37, Product.java:9, public.ts:165 | Technical | Có | Có | Có (URL path) | SEO URL | Hoàn chỉnh | |
| name | ProductDetailScreen.jsx:328, UpsertProductRequest.java:23, ProductEntity.java:39, Product.java:10, public.ts:166 | Website Display Data | Có | Có | Có | Tên sản phẩm | Hoàn chỉnh | |
| shortDescription | ProductDetailScreen.jsx:329, UpsertProductRequest.java:27, ProductEntity.java:43, Product.java:11, public.ts:167 | Website Display Data | Có | Có | Có (PDP dưới title, product card) | Mô tả ngắn | Hoàn chỉnh | |
| description | ProductDetailScreen.jsx:330, UpsertProductRequest.java:29, ProductEntity.java:47, Product.java:12, public.ts:168 | Website Display Data | Có (rich text) | Có | Có (tab "Mô tả sản phẩm") | Mô tả chi tiết | Hoàn chỉnh | |
| contentBottom | ProductDetailScreen.jsx:321, UpsertProductRequest.java:63, ProductEntity.java:141, Product.java:34, public.ts:188 | SEO Data | Có (rich text) | Có | Có (below PDP fold) | Long-form SEO copy | Hoàn chỉnh | |
| brand (id, name, slug) | ProductDetailScreen.jsx:369, UpsertProductRequest.java:33, ProductEntity.java:49, Product.java:13, public.ts:170 | Website Display Data | Có (select) | Có | Có (brand name trên card & PDP) | Thương hiệu | Hoàn chỉnh | |
| category (id, name, slug) | ProductDetailScreen.jsx:370, UpsertProductRequest.java:37, ProductEntity.java:53, Product.java:14, public.ts:171 | Website Display Data | Có (select) | Có | Có (breadcrumb, related) | Danh mục chính | Hoàn chỉnh | |
| categories (many-to-many) | ProductEntity.java:56-62, Product.java:15 | Operational Data | Không | Có (DB) | Có (filter by category slug) | Multi-category mapping | MISSING FROM ADMIN UI | Admin chỉ manage categoryId (primary), không có UI cho nhiều category |
| image (url, alt) | ProductDetailScreen.jsx:386, UpsertProductRequest.java:39, ProductEntity.java:72-80, Product.java:16, public.ts:173 | Website Display Data | Có (url + alt) | Có | Có (card, PDP hero) | Ảnh đại diện | Hoàn chỉnh | |
| image.width, image.height, image.mimeType | ProductEntity.java:79-81, GalleryImageRequest.java:12-16 | Technical | Không (backend nhận qua GalleryImageRequest) | Có | Không | Tối ưu responsive images | Unused — không được đặt vào admin form | |
| gallery (url, sortOrder) | ProductDetailScreen.jsx:396, UpsertProductRequest.java:72, ProductGalleryImageEntity.java, Product.java:17, public.ts:173 | Website Display Data | Có | Có | Có (slider ảnh PDP) | Gallery ảnh bổ sung | Hoàn chỉnh | Admin không có input alt cho gallery image — chỉ url |
| gallery.alt | GalleryImageRequest.java:9, ProductGalleryImageEntity.java:35 | Website Display Data | Không | Có (DB có trường imageAlt) | Không | Alt text accessibility | MISSING FROM ADMIN UI | Admin chỉ gửi url, không gửi alt |
| videos (url, title, provider) | ProductDetailScreen.jsx:397-406, UpsertProductRequest.java:75, ProductVideoEntity.java, Product.java:18, public.ts:175 | Website Display Data | Có | Có | Có (tab "Video") | Video sản phẩm | Hoàn chỉnh | |
| videos.thumbnailUrl | VideoRequest.java:13, ProductVideoEntity.java:37 | Website Display Data | Không | Có (DB có thumbnailUrl) | Có (video.thumbnail trong VideoAsset) | Thumbnail cho video | MISSING FROM ADMIN UI | Admin không có input cho thumbnail video |
| price.retailPrice | ProductDetailScreen.jsx:372, UpsertProductRequest.java:42, ProductEntity.java:82, Product.java:19, public.ts:109 | Website Display Data | Có | Có | Có | Giá niêm yết | Hoàn chỉnh | |
| price.compareAtPrice | ProductDetailScreen.jsx:375, UpsertProductRequest.java:44, ProductEntity.java:85, Product.java:19, public.ts:110 | Website Display Data | Có | Có | Có (gạch ngang) | Giá gốc để hiển thị giảm giá | Hoàn chỉnh | |
| price.salePrice | ProductDetailScreen.jsx:378, UpsertProductRequest.java:47, ProductEntity.java:88, Product.java:19, public.ts:111 | Website Display Data | Có | Có | Có (giá hiển thị) | Giá khuyến mãi | Hoàn chỉnh | |
| price.currency | ProductDetailScreen.jsx:446 (hardcoded 'VND'), UpsertProductRequest.java:49, ProductEntity.java:91 | Operational Data | Hardcoded 'VND' | Có | Không | Đơn vị tiền tệ | Hoàn chỉnh | Hardcode hợp lý cho thị trường VN |
| stockState | ProductDetailScreen.jsx:327, UpsertProductRequest.java:52, ProductEntity.java:96, Product.java:20, public.ts:178 | Website Display Data | Có (select) | Có | Có (stock badge) | Trạng thái kho | Hoàn chỉnh | |
| stockQuantity | ProductEntity.java:99, Product.java:21 | Operational Data | Không | Có (DB) | Không trực tiếp | Số lượng tồn kho (product-level) | MISSING FROM ADMIN UI | Inventory module manage riêng; admin product form không có field này |
| trackSerials | ProductEntity.java:101 | Operational Data | Không | Có (DB) | Không | Bật/tắt theo dõi serial | MISSING FROM ADMIN UI | Chỉ manage qua migration script; Inventory module có UI riêng |
| manageStock | ProductEntity.java:104 | Operational Data | Không | Có (DB) | Không | Kiểm soát tồn kho | Suspicious — MISSING FROM ADMIN UI | WooCommerce migration field, không expose qua DTO |
| backorders | ProductEntity.java:107 | Operational Data | Không | Có (DB) | Không | Cho phép đặt hàng khi hết | Suspicious — MISSING FROM ADMIN UI | WooCommerce migration field, không expose qua DTO |
| weightKg | ProductEntity.java:110 | Operational Data | Không | Có (DB) | Không | Cân nặng sản phẩm (ship) | Suspicious | Schema WP migration, không dùng trong shipping logic hiện tại |
| lengthCm, widthCm, heightCm | ProductEntity.java:113-119 | Operational Data | Không | Có (DB) | Không | Kích thước (ship) | Suspicious | Schema WP migration, không expose qua DTO |
| forceOutOfStock | ProductDetailScreen.jsx:384, UpsertProductRequest.java:55, ProductEntity.java:122, Product.java:25 | Operational Data | Có (checkbox) | Có | Có (snapshot API) | Tắt bán thủ công | Hoàn chỉnh | |
| discountPercentOverride | ProductEntity.java:125 | Suspicious | Không | Có (DB) | Không | Override % giảm giá | Suspicious | Không expose qua DTO, không render, mục đích không rõ |
| publishStatus | ProductDetailScreen.jsx:329, UpsertProductRequest.java:53, ProductEntity.java:129, Product.java:26, public.ts:179 | Operational Data | Có (select) | Có | Có (filter admin; chỉ PUBLISHED visible trên web) | Trạng thái đăng | Hoàn chỉnh | |
| isFeatured | ProductDetailScreen.jsx:339, UpsertProductRequest.java:56, ProductEntity.java:132, Product.java:27, public.ts:180 | Operational Data | Có (checkbox) | Có | Có (homepage featured section) | Nổi bật trên homepage | Hoàn chỉnh | |
| showOnHomepage | ProductDetailScreen.jsx:340, UpsertProductRequest.java:57, ProductEntity.java:133, Product.java:28 | Operational Data | Có (checkbox) | Có | Không trực tiếp (dùng filterFeatured thay vào homepage) | Hiện trên homepage | Partial — web homepage dùng `filterFeatured: true` chứ không dùng showOnHomepage để fetch featured | |
| rating | ProductEntity.java:135, Product.java:30, public.ts:183 | Website Display Data | Không (read-only, managed by review system) | Có (denorm cache) | Có (stars trên card & PDP) | Điểm đánh giá TB | Hoàn chỉnh — by design | Documented trong UpsertProductRequest.java:59-62 |
| ratingCount | ProductEntity.java:138, Product.java:31, public.ts:184 | Website Display Data | Không (read-only) | Có (denorm cache) | Có (PDP) | Số lượt đánh giá | Hoàn chỉnh — by design | |
| seo.title | ProductDetailScreen.jsx:335, SeoMetaRequest.java:9, ProductEntity.java:144, SeoMeta.java:4, public.ts:93 | SEO Data | Có | Có | Có (meta title) | SEO title | Hoàn chỉnh | |
| seo.description | ProductDetailScreen.jsx:336, SeoMetaRequest.java:13, ProductEntity.java:147, SeoMeta.java:5, public.ts:94 | SEO Data | Có | Có | Có (meta description) | SEO description | Hoàn chỉnh | |
| seo.canonicalUrl | ProductDetailScreen.jsx:337, SeoMetaRequest.java:17, ProductEntity.java:150, SeoMeta.java:6, public.ts:95 | SEO Data | Có | Có | Có (canonical link) | Canonical URL | Hoàn chỉnh | |
| seo.ogImage (url, alt) | ProductDetailScreen.jsx:338, SeoMetaRequest.java:20, ProductEntity.java:152-160, SeoMeta.java:7, public.ts:96 | SEO Data | Có | Có | Có (og:image) | Open Graph image | Hoàn chỉnh | |
| seo.noIndex | ProductDetailScreen.jsx:337, SeoMetaRequest.java:23, ProductEntity.java:161, SeoMeta.java:8, public.ts:97 | SEO Data | Có (checkbox) | Có | Có (robots meta) | No-index control | Hoàn chỉnh | |
| specifications (name, value, group) | ProductDetailScreen.jsx:402-407, SpecificationRequest.java, ProductSpecificationEntity.java, ProductSpecification.java, public.ts:144 | Website Display Data | Có | Có | Có (tab "Thông số kỹ thuật") | Thông số kỹ thuật | Hoàn chỉnh | |
| variants (id, sku, name, stockState, image, isAvailable, options, gallery) | ProductDetailScreen.jsx:350-360, VariantRequest.java, ProductVariantEntity.java, ProductVariant.java, public.ts:123 | Website Display Data | Có | Có | Có (variant selector PDP) | Biến thể sản phẩm | Hoàn chỉnh | |
| variants.price (retailPrice, compareAtPrice, salePrice) | VariantRequest.java:20-25, ProductVariantEntity.java:34-42 | Website Display Data | Không — intentionally omitted | Có (DB có column) | Không — web dùng product-level price | Giá biến thể | Partially Suspicious | Admin có comment: "Variant price fields intentionally omitted". Web không render. Backend lưu column nhưng không nhận từ admin request |
| variants.quantityOnHand | ProductVariantEntity.java:59 | Operational Data | Không | Có (DB) | Không | Tồn kho variant | MISSING FROM ADMIN UI trong product form | Manage qua Inventory module |
| variants.trackSerials | ProductVariantEntity.java:62 | Operational Data | Không | Có (DB) | Không | Serial tracking variant | MISSING FROM ADMIN UI | Same as product-level |
| createdAt | ProductEntity.java:163, Product.java:36, public.ts:190 | System Data | Không | Có | Không (admin list show updatedAt) | Timestamp tạo | Hoàn chỉnh | |
| updatedAt | ProductEntity.java:166, Product.java:37, public.ts:191 | System Data | Không | Có | Không trực tiếp | Timestamp cập nhật | Hoàn chỉnh | |
| tags | ProductEntity.java:64-70, ProductTagEntity.java | Operational Data | Không | Có (DB many-to-many) | Không | Nhãn sản phẩm | MISSING FROM ADMIN UI | Exists in DB but no API exposure, no admin UI, no web render |

---

## Website Display Data Mapping

| Website UI Section | Field đang dùng | Source API field (file:line) | Admin có quản lý không | Có vấn đề gì không |
|---|---|---|---|---|
| Product Card — thumbnail | product.image.url, product.image.alt | public.ts:43-50; Product.java:16 | Có | Không |
| Product Card — brand | product.brand.name | public.ts:157-160; Product.java:13 | Có | Không |
| Product Card — name | product.name | public.ts:166; Product.java:10 | Có | Không |
| Product Card — rating stars | product.rating | public.ts:183; Product.java:30 | Không (auto-managed) | Không — by design |
| Product Card — price (current, compare) | product.price.retailPrice, product.price.compareAtPrice, product.price.salePrice | public.ts:107-112; Product.java:19 | Có | Không |
| Product Card — stock badge | product.stockState | public.ts:102-105; Product.java:20 | Có | Không |
| PDP — meta title | product.seo.title ?? product.name | product/[slug]/page.tsx:69 | Có | Không — fallback đúng |
| PDP — meta description | product.seo.description ?? product.shortDescription | product/[slug]/page.tsx:71 | Có | Không — fallback đúng |
| PDP — canonical | product.seo.canonicalUrl ?? slug-derived | product/[slug]/page.tsx:74 | Có | Không |
| PDP — og:image | product.image.url | product/[slug]/page.tsx:76 | Có | `seo.ogImage` không được dùng ở đây — dùng `product.image.url` thay vì `seo.ogImage.url` |
| PDP — breadcrumb | product.category.name, product.category.slug | product/[slug]/page.tsx:160-175 | Có (qua category assignment) | Không |
| PDP — gallery & variant image | product.gallery, product.variants[].image, product.variants[].gallery | PurchaseSectionClient.tsx:63-64; public.ts:173,140 | Có | Không |
| PDP — pricing panel | product.price (fallback), snapshot API | PricingPanel.tsx, ProductSnapshotResponse.java | Có | Không — hybrid SSR/CSR đúng |
| PDP — stock status | product.stockState (fallback), snapshot API | StockStatus.tsx, ProductSnapshotResponse.java | Có | Không |
| PDP — variant selector | product.variants[].options, variants[].stockState, variants[].isAvailable | VariantSelector.tsx; public.ts:123 | Có | Không |
| PDP — short description | product.shortDescription | PurchaseSectionClient.tsx:59; product/[slug]/page.tsx:194 | Có | Không |
| PDP — tab "Mô tả" | product.description | ProductTabs.tsx:26; product/[slug]/page.tsx:213 | Có (rich text) | Không |
| PDP — tab "Thông số" | product.specifications[].name, .value (group field không render) | ProductTabs.tsx:92-98; public.ts:144 | Có | `spec.group` không được render trong spec table — field bị ignore trên web |
| PDP — tab "Video" | product.videos[].url, .title, .provider, .thumbnail | ProductTabs.tsx:103-150 | Có (url+title, không có thumbnail) | thumbnailUrl không manage qua Admin UI |
| PDP — content bottom | product.contentBottom | product/[slug]/page.tsx:263 | Có | Không |
| PDP — rating + reviews | product.rating, product.ratingCount | PurchaseSectionClient.tsx:58-59; ReviewsSection.tsx | Không (auto) | Không |
| PDP — JSON-LD Product | name, price, rating, image, brand, sku | product/[slug]/page.tsx:109 | Có | Không |
| PDP — JSON-LD FAQ | specifications[].name, .value | product/[slug]/page.tsx:113-118 | Có | Không |
| Homepage — featured grid | product.image, .name, .brand, .price, .slug | app/page.tsx:343 (FeaturedProductTile), filterFeatured:true | Có (isFeatured checkbox) | isFeatured controls this; showOnHomepage field không được dùng trực tiếp ở homepage fetch |
| Homepage — product carousel | product.image, .name, .brand, .price, .slug, .rating | app/page.tsx:279 (carouselProductsResult, size:5 latest) | Không (latest 5 products) | Carousel picks latest 5, không phải showOnHomepage — có thể gây nhầm lẫn nếu admin bật "Hiện trên homepage" nhưng product không xuất hiện carousel |
| Product listing page | product.image, .name, .brand, .price, .stockState, .rating, .slug | san-pham/page.tsx | Có | Không |
| Related products on PDP | Same as listing card, filtered by category.slug | product/[slug]/page.tsx:122-132 | Không (auto based on category) | Không |

---

## Internal / Operational Data Mapping

| Workflow | Field bắt buộc | Admin đã có chưa (file:line) | Backend đã support chưa (file:line) | Website có bị ảnh hưởng không | Gap |
|---|---|---|---|---|---|
| Tạo/sửa sản phẩm | name, slug, categoryId, retailPrice, stockState, publishStatus | Có — ProductDetailScreen.jsx:228-232 (publish readiness check) | Có — UpsertProductRequest.java, AdminCatalogController.java:107-124 | Không | Không |
| Publish/Unpublish | publishStatus transition DRAFT→PUBLISHED→HIDDEN | Có — getAllowedPublishStatuses, ProductDetailScreen.jsx:157-170 | Có — AdminCatalogController.java:126-136 ProductPublishRequest | Không | Không |
| Soft delete / Restore | publishStatus → TRASH / DRAFT | Có — ProductListScreen.jsx:78-122 | Có — AdminCatalogController.java:144-163 | Không | Không |
| Inventory tracking (quantity) | stockQuantity, trackSerials, manageStock | Không — không có UI trong product form | Có — ProductEntity.java:99-105, InventoryModule | Không trực tiếp | Inventory managed separately — acceptable gap |
| Homepage featured display | isFeatured | Có — ProductDetailScreen.jsx:339 | Có — CatalogReadService.java:67 (matchesFlag) | Có | Không |
| Homepage showOnHomepage | showOnHomepage | Có — ProductDetailScreen.jsx:340 | Có — DB + CatalogReadService.java:68 | Partial — homepage carousel không dùng field này | Semantic mismatch: Admin có checkbox "Hiện trên homepage" nhưng carousel ở homepage dùng latest 5, không phải showOnHomepage filter |
| Multi-category product | Assign product to multiple categories | Không — Admin chỉ có 1 categoryId select | Có — product_category_map table, ProductEntity.java:56-62 | Có (filter by category trên web dùng categories array) | Admin không thể manage secondary categories |
| Product tags | Tag sản phẩm | Không | Có — ProductTagEntity.java, product_tag_map table | Không | Tags hoàn toàn không accessible qua API |
| Variant-level price | retailPrice, compareAtPrice, salePrice per variant | Không — intentionally omitted (ProductDetailScreen.jsx:1010-1013) | Có — VariantRequest.java:20-25, ProductVariantEntity.java:34-42 | Không (web dùng product-level price) | By design — nhưng variant price columns trong DB là dead weight |
| Serial tracking | trackSerials | Không — product form | Có — backend support | Không | Inventory module scope |

---

## Unused / Suspicious Fields

| Field | File xuất hiện (file:line) | Lý do đáng nghi | Có nên giữ? | Đề xuất xử lý |
|---|---|---|---|---|
| discountPercentOverride | ProductEntity.java:125-127 | Có trong DB nhưng không expose qua DTO (UpsertProductRequest không có), không render web, không dùng trong bất kỳ business logic nào đã trace | Không rõ | Xem lại mục đích gốc; nếu không cần thì bỏ column để tránh confusion |
| manageStock | ProductEntity.java:104-105 | WooCommerce migration field, không expose qua DTO, không dùng trong service | Có thể không cần | Deprecate — hoặc tích hợp vào Inventory module logic |
| backorders | ProductEntity.java:107-109 | WooCommerce migration field, không expose qua DTO, không dùng trong stock/checkout logic | Có thể không cần | Deprecate — hoặc implement backorder logic rõ ràng |
| weightKg, lengthCm, widthCm, heightCm | ProductEntity.java:110-120 | Dimensions tồn tại trong DB nhưng không có DTO, không expose qua API, không dùng trong shipping service | Có thể cần cho shipping | Add vào UpsertProductRequest và Admin UI nếu có shipping weight-based pricing |
| tags (ProductTagEntity) | ProductEntity.java:64-70; ProductTagEntity.java (inferred) | Tags có trong DB (product_tag_map) nhưng không expose qua Product domain/DTO/API/UI | Có thể cần | Implement tag management UI và API, hoặc drop nếu không có roadmap |
| variants.retailPrice/compareAtPrice/salePrice columns | ProductVariantEntity.java:34-42 | Columns tồn tại trong DB, DTO có accept (VariantRequest.java:20-25), nhưng Admin intentionally không gửi (ProductDetailScreen.jsx:1010-1013), Web không render | Ambiguous | Đánh dấu "reserved for future use" hoặc drop columns để tránh DB confusion |
| legacyId | ProductEntity.java:31-33 | WordPress migration residual ID. Không expose qua bất kỳ API nào | Có (nếu vẫn cần redirect) | Giữ nhưng document rõ mục đích — chỉ dùng cho redirect lookup |
| showOnHomepage (functional gap) | ProductDetailScreen.jsx:340; ProductEntity.java:133; app/page.tsx:279 | Admin có checkbox, DB lưu, nhưng homepage carousel KHÔNG dùng field này để filter — dùng latest 5 thay vào | Có | Fix homepage carousel để dùng showOnHomepage filter, hoặc xoá checkbox trong admin nếu không có kế hoạch implement |

---

## Missing Fields

| Missing Field | Vì sao cần | Website/Internal | Nơi nên thêm | Priority |
|---|---|---|---|---|
| gallery[].alt (admin UI) | Alt text cho accessibility và SEO của gallery images | Website (accessibility) | ProductDetailScreen.jsx GalleryCard component — thêm input alt sau URL input | P1 |
| videos[].thumbnail (admin UI) | Thumbnail cho video embed trước khi load — web có render `video.thumbnail` (ProductTabs.tsx:129) | Website | ProductDetailScreen.jsx VideoEditor component | P2 |
| Secondary categories UI | Product có product_category_map table nhưng admin chỉ assign 1 category | Internal | ProductDetailScreen.jsx — thêm multi-select cho categories | P2 |
| Tags UI | Tags có trong DB nhưng không quản lý được | Internal | ProductDetailScreen.jsx — thêm TagInput component cho tags | P2 |
| og:image seo field usage | web/product/[slug]/page.tsx:76 dùng `product.image.url` làm og:image thay vì `product.seo.ogImage.url` — admin có thể đặt ogImage riêng nhưng bị ignore | SEO | product/[slug]/page.tsx:76 — ưu tiên `product.seo?.ogImage?.url ?? product.image?.url` | P1 |
| Product dimensions (weight/length/width/height) | Shipping calculation cần dimensions nếu implement weight-based shipping | Internal/Operational | UpsertProductRequest.java + ProductDetailScreen.jsx (Shipping section) | P2 |
| Spec group rendering | `spec.group` (ProductSpecification.group) có trong data nhưng web không render group header | Website | ProductTabs.tsx — group specs by group field, render group label | P2 |

---

## Data Contract Mismatches

| Concept | Admin field (file:line) | API field (file:line) | DB field (file:line) | Web field (file:line) | Có nhất quán không | Đề xuất |
|---|---|---|---|---|---|---|
| SEO og:image usage in PDP metadata | seoOgImageUrl → payload.seo.ogImage (ProductDetailScreen.jsx:455-458) | SeoMetaRequest.ogImage → ProductEntity.seoOgImageUrl (ProductEntity.java:152) | seo_og_image_url | product.seo.ogImage (public.ts:96) | Lưu đúng, nhưng generateMetadata dùng `product.image.url` thay vì `product.seo?.ogImage?.url` (product/[slug]/page.tsx:76) | Sửa generateMetadata để ưu tiên seo.ogImage.url |
| Spec group field name | form.specifications[].groupName (ProductDetailScreen.jsx:407) | SpecificationRequest.groupName (SpecificationRequest.java:13) | group_name (ProductSpecificationEntity.java:33) | ProductSpecification.group (ProductSpecification.java:3; public.ts:147) | Tên không thống nhất: admin/dto dùng `groupName`, domain record dùng `group` | Acceptable nếu service layer map đúng — confirm AdminCatalogMutationService map groupName→group |
| isFeatured API payload name | form.isFeatured → payload.featured (ProductDetailScreen.jsx:449) | UpsertProductRequest.setFeatured() (UpsertProductRequest.java:236) | is_featured column | product.isFeatured (public.ts:180) | Mismatch: admin gửi `featured` (not `isFeatured`), backend setter là `setFeatured` | Not a bug (Jackson maps `featured` to `setFeatured`) — nhưng confusing |
| showOnHomepage — functional semantics | Admin checkbox: "Hiện trên homepage" → showOnHomepage=true (ProductDetailScreen.jsx:340) | UpsertProductRequest.showOnHomepage (line:57) | show_on_homepage | app/page.tsx:278 dùng `filterFeatured: true` (not showOnHomepage) cho carousel | Semantic mismatch: admin implies showOnHomepage controls homepage carousel, but carousel uses `isFeatured` filter | Either fix homepage carousel to use showOnHomepage, or rename admin checkbox to clarify intent |
| Variant price — intentional gap | Admin không có variant price UI (ProductDetailScreen.jsx:1010-1013 comment) | VariantRequest has retailPrice/compareAtPrice/salePrice (VariantRequest.java:20-25) | ProductVariantEntity has price columns (lines:34-42) | Web uses product-level price only (PricingPanel.tsx) | Documented intentional gap — but creates dead DB columns | Document as "reserved for future variant pricing"; consider dropping columns if no roadmap |
| filter_gender — broken filter | Web gửi `filter_gender` param (san-pham/page.tsx:43) | CatalogController.java:66-71 rejects filter_gender with ValidationException | N/A | N/A | BROKEN: Web sends param, backend hard-rejects it with error | Either remove filter_gender from web UI entirely, or implement backend filtering |

---

## Findings

### P0 - Must fix before launch

Không có P0 hard-blocker. Tất cả core data flow (create, read, update, delete, publish, web display) đều hoạt động đúng.

### P1 - Should fix

**P1-PRODUCT-001: og:image metadata không dùng seo.ogImage**  
- File: `bigbike-web/app/product/[slug]/page.tsx` line 76
- Vấn đề: `generateMetadata` dùng `product.image?.url` làm `ogImage`, ignore `product.seo?.ogImage?.url` mà admin đã set
- Impact: Admin đặt custom OG image cho Facebook/Zalo share nhưng bị ignore hoàn toàn
- Fix: Thay `ogImage: product.image?.url ?? undefined` thành `ogImage: product.seo?.ogImage?.url ?? product.image?.url ?? undefined`

**P1-PRODUCT-002: filter_gender bị backend reject nhưng web vẫn gửi**  
- Backend file: `bigbike-backend/.../api/catalog/CatalogController.java` lines 66-71 — throws ValidationException
- Web file: `bigbike-web/app/san-pham/page.tsx` lines 88-92 — gửi `filterGender` param
- Impact: Nếu user truy cập URL với `filter_gender=nam`, trang trả về error state thay vì danh sách sản phẩm
- Fix: Hoặc remove `filter_gender` param khỏi web hoàn toàn, hoặc implement backend filtering

**P1-PRODUCT-003: gallery[].alt không có UI trong Admin**  
- File: `bigbike-admin/src/screens/ProductDetailScreen.jsx` lines 544-593 (GalleryCard component) — không có input cho alt
- File: `bigbike-admin/src/screens/ProductDetailScreen.jsx` lines 467-471 (toPayload) — gửi `url` và `sortOrder` nhưng không gửi `alt`
- Impact: Tất cả product gallery images không có alt text → accessibility và SEO bị ảnh hưởng
- Fix: Thêm input `alt` vào GalleryCard; update toPayload để include `alt`

**P1-PRODUCT-004: showOnHomepage vs isFeatured semantic mismatch**  
- Admin: `bigbike-admin/src/screens/ProductDetailScreen.jsx` lines 2014-2027 — hai checkbox riêng biệt "Nổi bật" và "Hiện trên homepage"
- Web homepage: `bigbike-web/app/page.tsx` line 278 — carousel dùng `filterFeatured: true` (isFeatured), không dùng showOnHomepage
- Impact: Admin bật "Hiện trên homepage" nhưng product không xuất hiện trong carousel homepage — misleading UX
- Fix: Sửa homepage carousel để dùng `showOnHomepage: true` filter, HOẶC cập nhật admin label để rõ ràng isFeatured mới control carousel

### P2 - Cleanup

**P2-PRODUCT-001: Video thumbnail không có Admin UI**  
- Backend: `VideoRequest.java` line 13 có `thumbnailUrl`; `ProductVideoEntity.java` line 37 lưu thumbnailUrl
- Web: `ProductTabs.tsx` line 129 render `video.thumbnail` (VideoAsset.thumbnail)
- Admin: `ProductDetailScreen.jsx` VideoEditor — không có field cho thumbnail
- Đề xuất: Thêm optional thumbnail picker vào VideoEditor

**P2-PRODUCT-002: spec.group không render trên web**  
- Data có: `ProductSpecification.java` line 3, `public.ts` line 147
- Web: `ProductTabs.tsx` lines 90-99 — render specs nhưng không group theo `spec.group`
- Đề xuất: Group specs bằng header rows trong spec table

**P2-PRODUCT-003: Dead DB fields — discountPercentOverride, manageStock, backorders, dimensions**  
- `ProductEntity.java` lines 104-120, 125-127
- Không expose qua DTO, không có Admin UI, không dùng trong business logic
- Đề xuất: Review với team — nếu không có roadmap implementation thì drop columns trong migration

**P2-PRODUCT-004: ProductTagEntity — tags hoàn toàn không accessible**  
- `ProductEntity.java` lines 64-70 — many-to-many với ProductTagEntity
- Không có API endpoint, không có Admin UI, không có web render
- Đề xuất: Implement tags nếu cần cho filtering/SEO, hoặc document là "future feature"

**P2-PRODUCT-005: Secondary categories không manage được**  
- `ProductEntity.java` lines 56-62 — product_category_map exists
- `CatalogReadService.java` line 133 — matchesCategory dùng `product.categories()` (plural)
- Admin: chỉ có 1 categoryId select
- Đề xuất: Thêm multi-category selector trong Admin product form

**P2-PRODUCT-006: Variant price columns là dead weight**  
- `ProductVariantEntity.java` lines 34-42 — có columns retailPrice, compareAtPrice, salePrice
- Admin intentionally không collect (ProductDetailScreen.jsx line 1010-1013)
- Web dùng product-level price
- Đề xuất: Document là "reserved for future"; thêm comment trong DB migration

---

## Recommended Product Data Model

### Display Data (for website rendering)

```
id: string
slug: string
name: string
shortDescription: string | null
description: string | null (rich HTML)
contentBottom: string | null (rich HTML, SEO long-form)
brand: { id, slug, name }
category: { id, slug, name }
image: { url, alt, width?, height? }
gallery: Array<{ url, alt, width?, height? }>
videos: Array<{ url, title, provider, thumbnail?: { url, alt } }>
price: { retailPrice, compareAtPrice?, salePrice?, currency }
stockState: IN_STOCK | LOW_STOCK | OUT_OF_STOCK
variants: Array<{
  id, sku, name,
  options: Array<{ name, value }>,
  stockState, isAvailable,
  image?: { url, alt },
  gallery?: Array<{ url, alt }>
}>
specifications: Array<{ name, value, group? }>
rating: number | null
ratingCount: number | null
```

### Operational Data (for internal management)

```
publishStatus: DRAFT | PUBLISHED | HIDDEN | TRASH
isFeatured: boolean
showOnHomepage: boolean
forceOutOfStock: boolean
stockQuantity: number | null (product-level, from inventory)
trackSerials: boolean (from inventory module)
sku: string | null
```

### SEO Data

```
seo: {
  title: string | null
  description: string | null
  canonicalUrl: string | null
  ogImage: { url, alt } | null
  noIndex: boolean
}
```

### System Data

```
id: string (UUID)
legacyId: string | null (WP migration)
createdAt: Instant
updatedAt: Instant
currency: "VND" (hardcoded)
```

---

## Action Plan

| Priority | Action | Files | Reason |
|---|---|---|---|
| P1 | Fix generateMetadata để ưu tiên seo.ogImage.url | `bigbike-web/app/product/[slug]/page.tsx:76` | Admin set custom OG image bị ignore |
| P1 | Remove filter_gender từ web hoặc implement backend | `bigbike-web/app/san-pham/page.tsx:88-92`, `bigbike-backend/.../CatalogController.java:66-71` | Backend reject với error, broken UX |
| P1 | Thêm gallery alt input vào Admin UI và toPayload | `bigbike-admin/src/screens/ProductDetailScreen.jsx` GalleryCard + toPayload | Alt text missing, accessibility + SEO issue |
| P1 | Làm rõ showOnHomepage vs isFeatured — fix carousel hoặc update label | `bigbike-web/app/page.tsx:278`, `bigbike-admin/src/screens/ProductDetailScreen.jsx:2014-2027` | Admin misleads operator |
| P2 | Render spec group trong ProductTabs | `bigbike-web/components/catalog/ProductTabs.tsx:90-99` | Grouping data exists but not shown |
| P2 | Thêm video thumbnail input vào VideoEditor | `bigbike-admin/src/screens/ProductDetailScreen.jsx` VideoEditor | Backend + web support it, admin doesn't |
| P2 | Review và drop dead DB columns: discountPercentOverride, manageStock, backorders, dimensions | `ProductEntity.java:104-127` | Dead weight from WP migration |
| P2 | Implement hoặc document tags feature | `ProductEntity.java:64-70`, `ProductTagEntity.java` | Completely inaccessible |
| P2 | Add secondary category management | `bigbike-admin/src/screens/ProductDetailScreen.jsx`, `AdminCatalogController.java` | Multi-category supported in DB but not admin |

---

## Acceptance Criteria

- [x] Every admin field has a clear business purpose — EXCEPT: discountPercentOverride, manageStock, backorders, dimensions (P2 cleanup)
- [x] No field shown in admin but not saved to backend — all admin UI fields have backend DTO counterparts
- [x] Website product page/listing/homepage has all needed data — EXCEPT: og:image uses wrong source (P1), spec groups not rendered (P2)
- [ ] SEO metadata properly managed — PARTIALLY: og:image source bug (P1)
- [x] Internal/operational data sufficient for product management — core fields complete; dimensions/tags are roadmap items
- [ ] Consistent data contracts across admin/backend/web — PARTIALLY: showOnHomepage semantic mismatch (P1), filter_gender broken (P1), spec groupName vs group naming (P2 / acceptable)
- [x] No legacy fields causing confusion without intentional fallback — legacyId is documented; others need P2 review
- [x] All findings cite file path + line number
