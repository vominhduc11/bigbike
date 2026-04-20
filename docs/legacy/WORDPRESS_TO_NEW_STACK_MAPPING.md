# WordPress To New Stack Mapping

Discovery date: 2026-04-20

This is a sanitized bridge document for moving from the local legacy WordPress source to the new BigBike stack. It is not an import script and it does not authorize copying raw SQL/source data into the repository.

## Migration Principle

Use the WordPress export as a local reference only. Convert observed behavior into contracts, route maps, schemas, and sanitized import logic before implementing features.

## Application Mapping

| Legacy surface | New-stack owner | Mapping notes |
|---|---|---|
| WordPress theme `bigbike` | `bigbike-web` | Rebuild templates as public SEO commerce pages. Preserve routes and content structure first. |
| WooCommerce product/order core | `bigbike-backend` | Backend owns product, stock, price, cart, checkout, order, customer, and status logic. |
| WooCommerce admin | `bigbike-admin` | Admin should manage products, categories, brands, orders, content, and settings through new APIs. |
| ACF fields | Data contract and CMS/content modules | Convert field names into typed contract fields before implementation. |
| Pods `slider` and `video` | Content model | Preserve as homepage slider and product/experience video content if still needed. |
| Rank Math SEO | Web SEO metadata and redirect system | Preserve title, description, canonical, robots, and redirects through sanitized extraction. |
| Polylang | TBD i18n strategy | Legacy has translation taxonomies. Do not assume a new i18n model until scoped. |
| Contact Form 7 | Contact/support module | Rebuild contact form behavior without importing raw submissions. |
| Wordfence/cache/optimizer plugins | Infrastructure/security | Do not port plugin behavior directly; replace with stack-native security and caching. |

## Data Mapping

| Legacy data | Source | New contract target | Required action |
|---|---|---|---|
| Product | `kd_posts`, `kd_postmeta`, Woo lookup tables | Product model | Update `DATA_CONTRACT.md` before implementation. |
| Product variant | `product_variation`, variation meta | Variant/options model | Define option/attribute model and stock rules. |
| Product category | `product_cat`, term meta | Category model | Preserve slug, hierarchy, hero/content fields. |
| Product brand | `pwb-brand`, brand term meta | Brand model | Preserve slug, logo/banner fields. |
| Product media | attachments, image/gallery meta | Media model | Map to `image.url`, `gallery[]`, `videos[]`. |
| Blog/news | `post`, `category`, `post_tag` | Content model | Preserve `/tin-tuc/{slug}.html` unless redirect plan changes. |
| Static page | `page`, ACF fields | Content/page model | Preserve existing slugs. |
| Slider | `slider` and/or ACF `sliders` | Homepage content | Confirm source of truth before implementing editor UI. |
| Video | `video`, ACF `youtube_url`, product `videos` | Video/content model | Preserve YouTube references and product associations. |
| Customer/user | `kd_users`, `kd_usermeta`, customer lookup | Auth/customer model | Never import raw PII into repo artifacts. Define sanitizer/import policy. |
| Order | `shop_order`, order item tables, lookup tables | Order model | Define status/payment/fulfillment snapshots first. |
| Redirects | Rank Math and `fg_redirect` tables | Redirect map | Use a dedicated sanitizer pass before adding detailed redirects. |

## Legacy Behaviors To Preserve

- Public SEO routes should be preserved first; route changes require `SEO_REDIRECT_MAP.csv` updates.
- Product pages need gallery, variation selection, ratings display, technical information tab, and videos tab.
- Product listing pages need category, brand, price, color, gender, search, and pagination compatibility.
- Homepage needs slider, featured products, highlighted categories, review/blog/video sections, brand carousel, and bottom content.
- Cart and checkout need backend validation for price, stock, variation, quantity, customer fields, shipping, and payment.
- Quick-buy behavior exists, but the business rule must be confirmed before implementing.
- Login/register/profile update behavior exists, but the new identity policy must be defined before implementation.

## New Stack Contract Work Before Implementation

Before building product/order/content/auth features, update the relevant source of truth:

- Product/category/brand/media/variant mapping: `docs/contracts/DATA_CONTRACT.md`
- Cart/checkout/order request and response shapes: `docs/contracts/API_CONTRACT.md`
- Order/payment/fulfillment statuses: `docs/contracts/STATE_MACHINES.md`
- Checkout/admin workflows: `docs/business/WORKFLOW.md`
- Route behavior: `docs/legacy/SEO_REDIRECT_MAP.csv`

## Import Safety Rules

- Do not commit `sqldump.sql`.
- Do not commit raw WordPress source.
- Do not commit `wp-config.php` values.
- Do not commit customer/order/user/email/phone/address/password/session/token values.
- Do not commit unsanitized redirect exports from `kd_fg_redirect` or Rank Math tables.
- Any importer must read local legacy data and emit only sanitized artifacts or new-stack records in a controlled environment.

## Open Questions

- Is social login still required? Nextend source/table exists, but it is not active in the dump option.
- Should blog URLs keep `.html` permanently or redirect to clean URLs after launch?
- Should quick-buy create accounts, guest orders, or leads in the new stack?
- Which legacy order statuses map to the final new order/payment/fulfillment state machines?
- Should Polylang translations be migrated in phase one?
