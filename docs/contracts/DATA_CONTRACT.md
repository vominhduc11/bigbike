# DATA_CONTRACT.md

> Data contract source cho BigBike.
>
> File này mô tả model dữ liệu ở mức contract giữa backend, web và admin. Đây không phải migration SQL, không phải JPA entity, không phải UI layout.
>
> Mục tiêu là thống nhất field name, type, nullable rule, status value, snapshot rule và data ownership. Nếu mỗi app tự hiểu `product.image`, `imageUrl`, `images`, `gallery` một kiểu thì xin chúc mừng, bạn vừa tạo ra một lễ hội bug.

---

## 1. Purpose

`DATA_CONTRACT.md` là nguồn chuẩn cho dữ liệu trao đổi giữa:

- `bigbike-backend`
- `bigbike-web`
- `bigbike-admin`

File này dùng để:

- Chuẩn hóa model.
- Tránh lệch field name giữa frontend/backend.
- Xác định field required/optional.
- Xác định status enum concept.
- Xác định snapshot data cho order.
- Làm nguồn tham chiếu cho API responses.
- Giúp AI agent không tự phát minh schema.

File này không định nghĩa:

- Database table chi tiết.
- ORM annotations.
- API endpoint.
- UI component.
- Business workflow từng bước.

---

## 2. Naming Convention

### 2.1 API JSON naming

API JSON dùng `camelCase`.

Examples:

```json
{
  "createdAt": "2026-04-20T03:30:00Z",
  "retailPrice": 1250000,
  "publishStatus": "PUBLISHED"
}
```

### 2.2 Database naming

Nếu backend dùng SQL, database nên dùng `snake_case`.

Examples:

```text
created_at
retail_price
publish_status
```

### 2.3 ID format

ID có thể là UUID, ULID hoặc prefixed string. Contract chỉ yêu cầu:

- Stable.
- Unique trong resource type.
- Không null.
- Không dùng auto-increment public nếu có rủi ro scraping/guessing.

Examples:

```text
prod_123
ord_123
cat_123
```

---

## 3. Common Types

### 3.1 Money

```ts
type Money = {
  amount: number;      // integer VND amount
  currency: "VND";
};
```

Rule:

- Không dùng float cho tiền.
- `amount` không âm trừ khi field đặc biệt như adjustment/refund.
- Public display format do frontend xử lý.

### 3.2 ImageAsset

```ts
type ImageAsset = {
  id?: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  mimeType?: string;
};
```

Rule:

- `url` required nếu image tồn tại.
- Public image nên có `alt`.
- Không expose local server path.

### 3.3 VideoAsset

```ts
type VideoAsset = {
  id?: string;
  url: string;
  title?: string;
  thumbnail?: ImageAsset;
  provider?: "UPLOAD" | "YOUTUBE" | "VIMEO" | "OTHER";
};
```

### 3.4 SeoMeta

```ts
type SeoMeta = {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: ImageAsset;
  noIndex?: boolean;
};
```

### 3.5 AuditFields

```ts
type AuditFields = {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
};
```

Datetime format: ISO-8601.

---

## 4. Product Model

### 4.1 Product

```ts
type Product = {
  id: string;
  sku?: string;
  slug: string;
  name: string;
  shortDescription?: string;
  description?: string;

  brand?: BrandSummary;
  category: CategorySummary;
  categories?: CategorySummary[];

  image?: ImageAsset;
  gallery?: ImageAsset[];
  videos?: VideoAsset[];

  price: ProductPrice;
  variants?: ProductVariant[];

  specifications?: ProductSpecification[];
  stockState: ProductStockState;
  publishStatus: PublishStatus;

  isFeatured?: boolean;
  showOnHomepage?: boolean;

  seo?: SeoMeta;

  createdAt: string;
  updatedAt: string;
};
```

### 4.2 ProductPrice

```ts
type ProductPrice = {
  retailPrice: number;
  compareAtPrice?: number;
  salePrice?: number;
  currency: "VND";
};
```

Rules:

- `retailPrice` required for normal sellable product.
- `salePrice` must be lower than `compareAtPrice` or `retailPrice` if used.
- Do not infer sale if no valid sale data.

### 4.3 ProductVariant

```ts
type ProductVariant = {
  id: string;
  sku?: string;
  name: string;
  options: ProductVariantOption[];
  price?: ProductPrice;
  stockState: ProductStockState;
  image?: ImageAsset;
  isAvailable: boolean;
};
```

### 4.4 ProductVariantOption

```ts
type ProductVariantOption = {
  name: string;   // e.g. "Size", "Color"
  value: string;  // e.g. "L", "Black"
};
```

### 4.5 ProductSpecification

```ts
type ProductSpecification = {
  name: string;
  value: string;
  group?: string;
};
```

### 4.6 ProductStockState

Official concept values:

```ts
type ProductStockState =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "PREORDER"
  | "CONTACT_FOR_STOCK";
```

If backend needs more states, update this file and `STATE_MACHINES.md` if transition-related.

### 4.7 PublishStatus

```ts
type PublishStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "HIDDEN"
  | "ARCHIVED";
```

Rules:

- Public website normally shows only `PUBLISHED`.
- Admin can show all statuses depending permission.
- `ARCHIVED` should not appear as sellable product.

---

## 5. Category Model

### 5.1 Category

```ts
type Category = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  parentId?: string;
  image?: ImageAsset;
  icon?: ImageAsset;
  seo?: SeoMeta;
  isVisible: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
};
```

### 5.2 CategorySummary

```ts
type CategorySummary = {
  id: string;
  slug: string;
  name: string;
};
```

Rules:

- Public category requires `slug`, `name`, `isVisible = true`.
- Category URL changes need SEO redirect process.

---

## 6. Brand Model

### 6.1 Brand

```ts
type Brand = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  logo?: ImageAsset;
  seo?: SeoMeta;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};
```

### 6.2 BrandSummary

```ts
type BrandSummary = {
  id: string;
  slug: string;
  name: string;
};
```

---

## 7. Cart Model

### 7.1 Cart

```ts
type Cart = {
  id: string;
  items: CartItem[];
  subtotal: number;
  discountTotal?: number;
  shippingEstimate?: number;
  total?: number;
  currency: "VND";
  updatedAt: string;
};
```

### 7.2 CartItem

```ts
type CartItem = {
  id: string;
  productId: string;
  variantId?: string;
  slug: string;
  name: string;
  image?: ImageAsset;
  selectedOptions?: ProductVariantOption[];
  unitPrice: number;
  compareAtPrice?: number;
  quantity: number;
  lineTotal: number;
  stockState: ProductStockState;
  availability: CartItemAvailability;
};
```

### 7.3 CartItemAvailability

```ts
type CartItemAvailability =
  | "AVAILABLE"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "PRODUCT_UNAVAILABLE"
  | "VARIANT_UNAVAILABLE";
```

Rule:

- Cart must not silently hide invalid items.
- UI must show availability problem.

---

## 8. Order Model

### 8.1 Order

```ts
type Order = {
  id: string;
  orderCode: string;

  customer: CustomerSnapshot;
  shippingAddress?: AddressSnapshot;

  items: OrderItem[];

  subtotal: number;
  discountTotal?: number;
  shippingFee?: number;
  total: number;
  currency: "VND";

  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  fulfillmentStatus?: FulfillmentStatus;

  note?: string;
  internalNote?: string;

  createdAt: string;
  updatedAt: string;
};
```

### 8.2 OrderItem

Order items must be snapshots, not live product references only.

```ts
type OrderItem = {
  id: string;
  productId: string;
  variantId?: string;

  sku?: string;
  slug?: string;
  name: string;
  image?: ImageAsset;
  selectedOptions?: ProductVariantOption[];

  unitPrice: number;
  quantity: number;
  lineTotal: number;

  productSnapshot?: Record<string, unknown>;
};
```

Rule:

- Order history must still render correctly if product changes later.
- Do not rely only on current product data for old orders.

### 8.3 CustomerSnapshot

```ts
type CustomerSnapshot = {
  customerId?: string;
  fullName: string;
  phone: string;
  email?: string;
};
```

### 8.4 AddressSnapshot

```ts
type AddressSnapshot = {
  fullName?: string;
  phone?: string;
  addressLine: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
};
```

### 8.5 OrderStatus

Concept values:

```ts
type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPING"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";
```

Transitions must align with `STATE_MACHINES.md`.

### 8.6 PaymentStatus

```ts
type PaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED";
```

### 8.7 PaymentMethod

```ts
type PaymentMethod =
  | "COD"
  | "BANK_TRANSFER"
  | "MANUAL"
  | "ONLINE";
```

Only expose methods actually supported by backend/business.

### 8.8 FulfillmentStatus

```ts
type FulfillmentStatus =
  | "NOT_FULFILLED"
  | "PREPARING"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "RETURNED";
```

---

## 9. Customer Model

### 9.1 Customer

```ts
type Customer = {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  status: CustomerStatus;
  addresses?: CustomerAddress[];
  createdAt: string;
  updatedAt: string;
};
```

### 9.2 CustomerStatus

```ts
type CustomerStatus =
  | "ACTIVE"
  | "DISABLED"
  | "ARCHIVED";
```

### 9.3 CustomerAddress

```ts
type CustomerAddress = {
  id: string;
  fullName?: string;
  phone?: string;
  addressLine: string;
  ward?: string;
  district?: string;
  province?: string;
  country?: string;
  isDefault?: boolean;
};
```

---

## 10. Admin User Model

### 10.1 AdminUser

```ts
type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
};
```

### 10.2 AdminUserStatus

```ts
type AdminUserStatus =
  | "ACTIVE"
  | "DISABLED";
```

### 10.3 Role

```ts
type Role = {
  id: string;
  name: string;
  description?: string;
};
```

### 10.4 Permission

```ts
type Permission = string;
```

Permission values are defined in:

```text
docs/contracts/PERMISSION_MATRIX.md
```

---

## 11. Content Model

### 11.1 Article

```ts
type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  body: string;
  coverImage?: ImageAsset;
  author?: AuthorSummary;
  category?: ContentCategorySummary;
  tags?: string[];
  publishStatus: PublishStatus;
  seo?: SeoMeta;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 11.2 Page

```ts
type Page = {
  id: string;
  slug: string;
  title: string;
  body: string;
  type: PageType;
  publishStatus: PublishStatus;
  seo?: SeoMeta;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

### 11.3 PageType

```ts
type PageType =
  | "ABOUT"
  | "CONTACT"
  | "POLICY"
  | "HELP"
  | "CUSTOM";
```

### 11.4 AuthorSummary

```ts
type AuthorSummary = {
  id: string;
  name: string;
};
```

### 11.5 ContentCategorySummary

```ts
type ContentCategorySummary = {
  id: string;
  slug: string;
  name: string;
};
```

---

## 12. Contact / Support Model

### 12.1 ContactRequest

```ts
type ContactRequest = {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  subject?: string;
  message: string;
  status: ContactRequestStatus;
  source?: ContactSource;
  createdAt: string;
  updatedAt: string;
};
```

### 12.2 ContactRequestStatus

```ts
type ContactRequestStatus =
  | "RECEIVED"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "SPAM"
  | "CLOSED";
```

### 12.3 ContactSource

```ts
type ContactSource =
  | "WEBSITE_FORM"
  | "HOTLINE"
  | "ZALO"
  | "MESSENGER"
  | "MANUAL"
  | "OTHER";
```

---

## 13. Promotion / Campaign Model

### 13.1 Campaign

```ts
type Campaign = {
  id: string;
  slug?: string;
  name: string;
  title: string;
  description?: string;
  status: CampaignStatus;
  startsAt?: string;
  endsAt?: string;
  bannerImage?: ImageAsset;
  targetUrl?: string;
  seo?: SeoMeta;
  createdAt: string;
  updatedAt: string;
};
```

### 13.2 CampaignStatus

```ts
type CampaignStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "ACTIVE"
  | "EXPIRED"
  | "DISABLED";
```

Discount calculation rules, if any, must be defined in business/backend docs, not guessed here.

---

## 14. Media Model

### 14.1 MediaAsset

```ts
type MediaAsset = {
  id: string;
  url: string;
  alt?: string;
  filename?: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  createdAt: string;
  updatedAt: string;
};
```

Rule:

- Do not expose local filesystem path.
- Public media should use URL safe for frontend rendering.
- Image dimensions are recommended to reduce layout shift.

---

## 15. Nullable vs Optional Rules

### 15.1 Required

Use required fields when frontend/backend cannot function without them.

Example:

```ts
Product.id
Product.name
Product.slug
Order.id
Order.orderCode
```

### 15.2 Optional

Use optional fields when data may not exist.

Example:

```ts
Product.sku?
Product.video?
Customer.email?
```

### 15.3 Null

Prefer omitting optional fields instead of sending `null`, unless API needs explicit null.

If API sends null, frontend must handle it.

No raw `null` should render in UI.

---

## 16. Public vs Admin Data Exposure

### 16.1 Public product

Public product should not expose:

- Internal cost.
- Supplier notes.
- Internal stock exact quantity if not intended.
- Draft/admin-only flags.
- Internal audit details.

### 16.2 Admin product

Admin product may expose:

- Publish status.
- Internal validation flags.
- Updated by.
- Stock quantity if supported.
- Internal notes if permission allows.

### 16.3 Customer data

Public API should expose only customer-owned data.

Admin API should expose customer data based on permission.

Never expose:

- Password hash.
- Secret tokens.
- Payment secrets.
- Sensitive internal logs.

---

## 17. SEO Data Rules

SEO fields are optional but should be supported for public resources:

- Product.
- Category.
- Brand.
- Article.
- Page.
- Campaign.

`SeoMeta.title` and `SeoMeta.description` may fallback to resource name/excerpt if missing.

No-index must be explicit:

```ts
noIndex?: boolean
```

---

## 18. Data Snapshot Rules

Snapshot required for:

- Order item product data.
- Customer contact at order time.
- Shipping address at order time.
- Price at order time.

Reason:

- Product/customer may change later.
- Historical order must remain accurate.
- Admin/customer order history must render without depending on current product state.

---

## 19. Unknown Value Handling

If frontend receives unknown enum:

- Do not crash.
- Render neutral fallback.
- Log/report if needed.
- Do not map unknown to success.

Example fallback:

```text
Unknown status
```

or Vietnamese UI copy:

```text
Trạng thái không xác định
```

---

## 20. Relationship With Other Docs

- `API_CONTRACT.md`: endpoint/request/response.
- `DATA_CONTRACT.md`: data model and enum concepts.
- `STATE_MACHINES.md`: allowed transitions.
- `PERMISSION_MATRIX.md`: roles/permissions.
- `BUSINESS_RULES.md`: business validation.
- `WEB_DESIGN.md`: public UI representation.
- `ADMIN_DESIGN.md`: admin UI representation.

---

## 21. AI Agent Rules

1. Do not rename fields without updating all consumers.
2. Do not introduce `imageUrl` if canonical field is `image.url`.
3. Do not introduce `images` if canonical field is `gallery`.
4. Do not invent enum values.
5. Do not expose internal fields publicly.
6. Do not use float for money.
7. Do not rely on live product data to render old orders.
8. Do not ignore nullable/optional fields.
9. Update `API_CONTRACT.md` if API response changes.
10. Update `STATE_MACHINES.md` if status transitions change.

---

## 22. Review Checklist

- [ ] Field names are camelCase in API.
- [ ] Money is integer VND amount.
- [ ] Product media uses `image` / `gallery`, not random legacy fields.
- [ ] Public/admin exposure boundary is clear.
- [ ] Status values align with `STATE_MACHINES.md`.
- [ ] Permission-related data aligns with `PERMISSION_MATRIX.md`.
- [ ] Order uses snapshots.
- [ ] Optional/null fields handled.
- [ ] SEO fields available for public resources.
- [ ] No secret/internal field exposed.

---

## 23. Phase 2 Legacy-Normalized Contract

This section normalizes the sanitized WordPress discovery into the new-stack data contract. It is based only on `docs/legacy/*`; raw `sqldump.sql`, `wp-config.php`, user rows, order rows, email, phone, address, password hash, session, token, and order key values are out of scope.

### 23.1 Internal legacy trace

Legacy trace fields are allowed only in backend/admin/internal migration contexts.

```ts
type LegacyTrace = {
  sourceSystem: "WORDPRESS_WOOCOMMERCE";
  sourceTable?: string;
  sourceId?: string;
  sourcePostType?: string;
  sourceTaxonomy?: string;
  sourceMetaKeys?: string[];
  migratedAt?: string;
};
```

Rules:

- Do not expose `LegacyTrace` on public APIs unless explicitly documented as non-sensitive.
- Do not store raw legacy serialized payloads in public-facing models.
- Do not commit legacy row samples unless a sanitizer has removed PII and secrets.

### 23.2 Product normalization

Legacy sources from sanitized discovery:

- Product: `kd_posts.post_type=product`
- Variation: `kd_posts.post_type=product_variation`
- Category: `product_cat`
- Brand: `pwb-brand`
- Product attributes: `pa_size`, `pa_color`, `pa_dungtich`, `pa_bo`, `pa_model`, `pa_gender`
- Media: attachments plus `_thumbnail_id`, `_product_image_gallery`, `rtwpvg_images`
- Product custom fields: `rating`, `rating_count`, `product_more_infomation`, `videos`, `content_bottom`, `featured`

Canonical product additions:

```ts
type ProductLegacyExtension = {
  legacy?: LegacyTrace;
  primaryCategory?: CategorySummary;
  tags?: string[];
  attributes?: ProductAttribute[];
  technicalInformationHtml?: string;
  ratingSummary?: RatingSummary;
  warrantyPolicy?: ProductWarrantyPolicy;
  saleNoWarrantyNotice?: string;
  contentBottomHtml?: string;
};

type ProductAttribute = {
  id: string;
  code: string;
  name: string;
  values: ProductAttributeValue[];
  isVariationAttribute: boolean;
  isPublic: boolean;
};

type ProductAttributeValue = {
  id: string;
  slug: string;
  label: string;
  swatchColor?: string;
  swatchImage?: ImageAsset;
};

type RatingSummary = {
  average?: number;
  count?: number;
};

type ProductWarrantyPolicy = {
  code: "STANDARD" | "SALE_NO_WARRANTY" | "CONTACT_FOR_POLICY" | "TBD";
  label: string;
  description?: string;
};
```

Rules:

- Money remains integer VND.
- Public slugs preserve legacy `/product/{product-slug}/` during migration unless `SEO_REDIRECT_MAP.csv` changes.
- `product_more_infomation` maps to `technicalInformationHtml` after sanitization.
- `videos` and `video` post type references map to `videos[]` after provider normalization.
- `rating` and `rating_count` map to `ratingSummary`; do not treat them as verified reviews unless review migration is scoped.
- `saleNoWarrantyNotice` must not be inferred from sale price. It requires an explicit business/policy source.

### 23.3 Category, brand, and taxonomy normalization

```ts
type CategoryLegacyExtension = {
  legacy?: LegacyTrace;
  heroImage?: ImageAsset;
  sideImage?: ImageAsset;
  contentTopHtml?: string;
  contentBottomHtml?: string;
  showOnHomepage?: boolean;
};

type BrandLegacyExtension = {
  legacy?: LegacyTrace;
  banner?: ImageAsset;
  contentBottomHtml?: string;
};
```

Rules:

- `product_cat` maps to `Category`.
- `pwb-brand` maps to `Brand`.
- `product_brand` was observed as residue and must not be treated as canonical until verified.
- `top_image`, `image_left`, `content_bottom`, `content_top`, `show_on_homepage`, `ordering`, `pwb_brand_image`, and `pwb_brand_banner` map to typed presentation fields after sanitization.

### 23.4 Content, page, news, slider, and video

Legacy source:

- Static pages: `post_type=page`
- News/blog: `post_type=post`, route `/tin-tuc/{post-slug}.html`
- Homepage sliders: ACF `sliders` and/or `post_type=slider`
- Videos: `post_type=video` plus `youtube_url`

```ts
type ContentLegacyExtension = {
  legacy?: LegacyTrace;
  routePath: string;
  templateKey?: string;
  heroImage?: ImageAsset;
  sideImage?: ImageAsset;
  contentBottomHtml?: string;
};

type HomepageBlock = {
  id: string;
  type: "SLIDER" | "FEATURED_PRODUCTS" | "CATEGORY_GRID" | "BRAND_CAROUSEL" | "ARTICLE_LIST" | "VIDEO_LIST" | "HTML_CONTENT";
  title?: string;
  items?: unknown[];
  bodyHtml?: string;
  sortOrder?: number;
};
```

Rules:

- Preserve published page slugs listed in `LEGACY_ROUTE_MAP.md`.
- Preserve blog `.html` route unless `SEO_MIGRATION_PLAN.md` and `SEO_REDIRECT_MAP.csv` are updated.
- `iframe_maps` and contact form config are content/config, not raw contact submissions.
- Contact Form 7 submissions are PII-bearing and must not be committed as samples.

### 23.5 Media path normalization

Legacy WordPress media paths under `wp-content/uploads` must map to a new storage URL.

```ts
type MediaMigrationMap = {
  legacyRelativePath: string;
  storageKey: string;
  publicUrl: string;
  alt?: string;
  width?: number;
  height?: number;
  mimeType?: string;
};
```

Rules:

- Public APIs expose `publicUrl` through `ImageAsset.url` or `MediaAsset.url`.
- Do not expose local filesystem paths.
- Do not commit raw upload binaries during contract work.
- Preserve alt text when present and sanitized.

### 23.6 Cart, checkout, quick-buy, and order normalization

Legacy source:

- Cart actions: `custom_add_to_cart`, `remove_item_from_cart`, `update_cart_item_quantity`
- Variation resolution: `find_variation_product`
- Quick-buy action: `buy_quickly`
- Orders: classic WooCommerce `shop_order`, order item tables, lookup tables

Canonical additions:

```ts
type OrderLegacyExtension = {
  legacy?: LegacyTrace;
  source?: OrderSource;
  confirmationRequired: boolean;
};

type OrderSource = "WEB_CHECKOUT" | "QUICK_BUY" | "MANUAL" | "LEGACY_IMPORT";

type CheckoutRequest = {
  cartId?: string;
  source: "WEB_CHECKOUT" | "QUICK_BUY";
  customer: CustomerSnapshot;
  shippingAddress?: AddressSnapshot;
  paymentMethod: PaymentMethod;
  note?: string;
  idempotencyKey?: string;
};
```

Rules:

- Order item, customer, address, price, and selected option data must be snapshots.
- `order-received` URLs must never expose real legacy order keys in docs, logs, fixtures, or samples.
- Quick-buy may be represented as `OrderSource.QUICK_BUY`, but account creation behavior is TBD.
- The observed legacy quick-buy shipping fee rule is not canonical until confirmed in `BUSINESS_RULES.md`.

### 23.7 Auth, account, recovery, and social login

Legacy source:

- Registration used phone as username and required email.
- Login accepted username or email.
- Password minimum length was 6 in legacy code.
- Profile update touched display name, gender, date of birth, and password.
- Nextend source/table exists, but plugin was not active in the dump option.

Canonical constraints:

- Do not migrate password hashes into repo artifacts.
- Do not commit user/customer samples with phone, email, address, or date of birth.
- Customer profile fields beyond checkout snapshots require explicit account contract work.
- Social login remains `TBD` until production behavior is verified.

### 23.8 Data migration constraints

- Raw WordPress source and raw SQL dump are local-only.
- Migration artifacts committed to repo must be schema-only or sanitized.
- Order/customer/user/comment/contact submissions are sensitive and require a dedicated sanitizer before any sample output.
- Redirect extraction from Rank Math and `fg_redirect` requires a dedicated sanitizer that emits route patterns only.

## 24. Open Questions

- Should `product_brand` be ignored permanently or mapped to `Brand` after live verification?
- Should blog/news keep `/tin-tuc/{slug}.html` permanently?
- Should quick-buy create customer accounts, guest orders, or leads?
- What is the approved canonical shipping fee policy?
- Which warranty/return rules apply to sale products and sale-no-warranty cases?
- Are preorder and backorder allowed for any product category?
- Is social login required in the new stack?
- Should Polylang translations migrate in phase one?
