# Architecture

## Monorepo Shape

| Path | Runtime | Responsibility | Status | Evidence |
|---|---|---|---|---|
| `bigbike-web` | Next.js 16.2.4 / React 19 | Public storefront, SEO pages, cart, checkout, customer account | `CONFIRMED_FROM_CODE` | `bigbike-web/package.json`, `bigbike-web/app`, `bigbike-web/lib` |
| `bigbike-admin` | Vite 8 / React 19 | Internal operations dashboard | `CONFIRMED_FROM_CODE` | `bigbike-admin/package.json`, `bigbike-admin/src` |
| `bigbike-backend` | Spring Boot 4.0.5 / Java 17 | API, business rules, persistence, auth, integrations, WebSocket | `CONFIRMED_FROM_CODE` | `bigbike-backend/pom.xml`, `src/main/java` |

## Runtime Boundaries

- `bigbike-web` is the public BFF/client layer and consumes backend REST APIs. `CONFIRMED_FROM_CODE`
- `bigbike-admin` is a separate SPA that consumes backend admin APIs and the admin order WebSocket. `CONFIRMED_FROM_CODE`
- `bigbike-backend` owns business validation, state changes, persistence, auth, and integrations. `CONFIRMED_FROM_CODE`

## Backend Architecture

### Primary backend layers

| Layer | Current implementation | Status | Evidence |
|---|---|---|---|
| Controllers | `api/admin`, `api/customer`, `api/order`, `api/public_`, `api/cart`, `api/checkout` | `CONFIRMED_FROM_CODE` | `src/main/java/com/bigbike/bigbike_backend/api` |
| Services | Business logic in `service/*` | `CONFIRMED_FROM_CODE` | `src/main/java/com/bigbike/bigbike_backend/service` |
| Persistence | JPA entities and repositories | `CONFIRMED_FROM_CODE` | `persistence/entity`, `persistence/repository` |
| Schema | Flyway versioned migrations (current repository through `V370`) plus dev seeds | `CONFIRMED_FROM_CODE_2026-08-03` | `src/main/resources/db/migration`, `db/migration-dev` |
| Auth | Admin JWT + customer cookie/session auth | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, auth services/filters |
| Real-time | STOMP over WebSocket with simple broker | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java` |

### Notable architectural realities

- OpenAPI is a checked-in companion file, not an automatically trusted source without verification. `CONFIRMED_FROM_STRUCTURE`
  Since 2026-08-21 the companion is cross-checked on every build against a springdoc-generated
  live specification (`OpenApiContractDriftTest`), with the 33 known gaps frozen in
  `contract-drift-baseline.json`. The generated document is off by default in every profile
  (`BIGBIKE_API_DOCS_ENABLED`) and hard-disabled under `prod`. `CONFIRMED_FROM_CODE_2026-08-21`
- POS (point-of-sale / walk-in) was **removed** platform-wide (owner decision 2026-06-23) — BigBike is online-only. The POS endpoints, `AdminPosController` / `PosOrderService`, and the `pos.*` permissions no longer exist; all sales go through the storefront checkout. `REMOVED`
- Serial-number tracking was removed platform-wide (2026-06-23, V259). Inventory is a **boolean availability toggle** (2026-06-23, V261): per-variant `is_available` / per-no-variant-product `stock_state`, set by hand; no tracked quantity, no auto-decrement on sale (admin marks "Hết hàng" manually, oversell not auto-prevented). The quantity columns are kept but dormant. The warranty feature was removed entirely (2026-06-23, V266) — no warranty records, services, lookup, or `/bao-hanh` page. `CONFIRMED_FROM_CODE`
- Receipt tables exist in the schema, but a receiving service/controller was not confirmed in the current Java layer. `NOT_FOUND_IN_REPO`
- Admin access synchronization uses Spring's in-process STOMP simple broker. It is correct for the
  current single `bigbike-backend` deployment, but cross-node access events and subscription checks
  require a shared broker/event bus before running multiple backend replicas. `OWNER_CONFIRMED_2026-07-31`

## Infrastructure And Integrations

| Component | Current implementation | Status | Evidence |
|---|---|---|---|
| Database | PostgreSQL via Docker Compose and CI service container | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `.github/workflows/ci.yml` |
| Object storage | MinIO S3-compatible storage | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `AdminMediaService.java` |
| Email | SMTP-backed transactional email when configured | `CONFIRMED_FROM_CODE` | `pom.xml`, `docker-compose.yaml`, mail services |
| Revalidation | Backend calls web revalidate endpoint through shared secret | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, web env vars |
| WebSocket | `/ws` STOMP endpoint, admin data topics and `/user/queue/admin/access` per-admin access signal | `OWNER_CONFIRMED_2026-07-31` | `WebSocketConfig.java`, `AdminAccessChangeService.java` |
| External payment gateway | No confirmed live provider/webhook integration | `NOT_FOUND_IN_REPO` | repo search, checkout/payment code |
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration | `NOT_FOUND_IN_REPO` | repo search |

## Storefront Rendering Strategy (`bigbike-web`)

Kiến trúc render: **ISR on-demand + SSG + CSR hybrid — KHÔNG SSR.** `CONFIRMED_FROM_CODE`

| Loại | Áp dụng | Cơ chế |
|---|---|---|
| **ISR on-demand** (admin content) | Route động admin quản lý không đọc request query ở server: `product/[slug]`, các route tĩnh theo slug | `generateStaticParams()` trả **`[]`** → **KHÔNG prebuild/gọi API lúc build**; trang sinh khi truy cập lần đầu rồi cache, revalidate qua `next.tags` (`product:{slug}`, `category:{slug}`, `brand:{slug}`, `article:{slug}`…). (Trang thông tin/chính sách `gioi-thieu`/`lien-he`/`huong-dan*`/`chinh-sach/*`/catch-all `[slug]` **không** còn thuộc nhóm này — chuyển sang tĩnh, xem hàng dưới; module pages + guide-page gỡ 2026-06-24.) |
| **Dynamic per request** (query-dependent) | `danh-muc/[slug]`, `brands/[slug]`, `sp`, `tim-kiem`, và các route đọc `searchParams` ở server | `searchParams` được đọc để dựng đúng lần xem đầu theo bộ lọc/phân trang; route dùng `force-dynamic` và không cache nhầm HTML lỗi hoặc dữ liệu của URL khác. Revalidation tag vẫn dùng cho các request sau. |
| **Static + ISR** (shell) | Trang chủ + các trang archive/list: `sp`, `tim-kiem`, `tin-tuc`, `brands`; **8 route thông tin/chính sách tĩnh**; các shell đăng nhập/đăng ký/quên mật khẩu, tài khoản, địa chỉ và đơn hàng cá nhân | Shell render tĩnh; dữ liệu admin (hero/settings) fetch với `next.tags` + revalidate on-demand. Các route info/policy giữ shell, title/SEO và sidebar cố định trong web, không gọi backend CMS: Privacy giữ nội dung tĩnh trong web, còn Warranty/Returns đọc body song ngữ từ `GET /api/v1/policies/{topic}` qua resource backend dùng chung với Trợ lý BigBike; Contact trong policy được hydrate động từ backend. `/lien-he` còn fetch `listPublicSettings` cho thông tin liên hệ dùng chung. `/chinh-sach/{slug}` chỉ build đúng 3 slug và tự dựng sidebar cố định; không đọc menu `policy`. Khu vực auth/tài khoản chỉ build shell; dữ liệu theo người dùng được lấy ở client sau khi đăng nhập. Hai segment động `tai-khoan/edit-address/[type]` và `tai-khoan/don-hang/[id]` dùng `force-static` + `generateStaticParams() = []`, không đọc session ở server. |
| **ISR revalidation** | Tất cả ở trên | Backend `WebRevalidationService` gọi `POST /api/revalidate` (`revalidateTag`) khi admin sửa nội dung/catalog. Checkout cũng có thể yêu cầu revalidate trang sản phẩm sau khi tạo đơn, nhưng đặt đơn **không tự đổi giá hay Còn/Hết** trong mô hình availability thủ công. |
| **CSR** | **PDP buy-box giá/tồn/biến thể** (`WpPurchaseSection` fetch `/api/products/[slug]/snapshot/` — mô tả/specs/ảnh vẫn ISR); lưới list lọc/phân trang/tìm (`WpCatalogClient`/`WpArticleListClient`/`WpBrandListClient`); giỏ hàng, đánh giá, auth, hồ sơ/địa chỉ, lịch sử/chi tiết đơn và tra cứu xác nhận đơn | React Query hoặc client API fetch sau khi shell tĩnh đã tải. Lưới có **skeleton** lần tải đầu (props ISR của PDP là giá trị ban đầu → PDP không cần skeleton). Dữ liệu cá nhân không được nhúng vào HTML cache chung. |
| **Dynamic (ƒ) hợp lệ** | Route handlers/API routes, gồm redirect tương thích `dat-hang/order-received/[id]` | Xử lý request/redirect ở server; không dùng cho page storefront hay trang tài khoản. |

**SSG thuần (fetch lúc build):** chỉ dùng cho dữ liệu tĩnh KHÔNG do admin quản lý. **Nội dung admin quản lý KHÔNG prebuild lúc build** — dùng ISR on-demand khi route không đọc query ở server, hoặc dynamic per request khi cần dựng đúng bộ lọc/phân trang từ URL. Không dùng cache tĩnh cho route đang đọc `searchParams` ở server.

**Nguyên tắc tách lớp ISR↔CSR (theo loại DỮ LIỆU, không theo trang):**
- **Cần SEO + ít đổi** (mô tả, ảnh, thông số, breadcrumb, metadata, carousel trang chủ, sản phẩm liên quan) → **ISR**; admin sửa → backend `revalidateTag` bust ngay.
- **Cần freshness cao, không cần SEO** (giá, badge "Còn hàng / Hết hàng") → **CSR** fetch sau khi page load. Áp dụng ở PDP buy-box (snapshot) + lưới browsing; KHÔNG CSR carousel trang chủ/sản phẩm liên quan (curated, ISR + revalidate là đủ tươi — tránh hại LCP/SEO).
- Điều kiện vận hành: ① backend phải gọi revalidate sau mỗi admin save (đã có — `WebRevalidationService`); ② lớp CSR có skeleton/fallback (lưới có skeleton; PDP dùng giá trị ISR ban đầu nên không cần).

**i18n & rendering (owner decision 2026-08-01):** URL là nguồn locale duy nhất. Tiếng Việt giữ URL không prefix; tiếng Anh luôn dùng prefix `/en` với segment đã địa phương hoá. Không đọc cookie hoặc `Accept-Language` để tự đổi locale. `next-intl` dùng một bảng `pathnames` tập trung và cây route `app/[locale]`; middleware chỉ rewrite URL VI không prefix sang locale nội bộ. Mọi page, layout, metadata và dữ liệu API render đúng locale ngay trên server, vì vậy HTML đầu tiên, `<html lang>`, header/footer và nội dung đều đồng bộ, không có lớp hoán đổi/refetch EN sau hydration. Mỗi URL locale có cache ISR/SSG độc lập; `timeZone` cố định `Asia/Ho_Chi_Minh`.

**URL locale:** trang VI giữ đường dẫn hiện hành; EN dùng `/en/product/{slug}` cho chi tiết sản phẩm, `/en/tin-tuc` cho danh sách/chi tiết bài viết, `/en/products` cho trang danh sách sản phẩm và `/en/categories` cho danh mục. Các route chi tiết cũ `/en/products/{slug}` và mọi route `/en/news...` trả 301 thẳng sang canonical mới. `slugEn` của sản phẩm/danh mục/bài viết chỉ chọn slug ưu tiên. Thiếu `slugEn` vẫn có trang EN bằng slug VI; có `slugEn` thì URL EN mang slug VI redirect 301 sang slug EN chuẩn. Chuyển ngôn ngữ dùng history push, giữ query/hash; `/vi/...` redirect về URL VI không prefix; locale không hỗ trợ trả 404/noindex. Canonical tự trỏ URL locale hiện tại; `hreflang` gồm `vi`, `en`, `x-default`. Thương hiệu dùng chung slug nhưng vẫn có hai URL `/brands/{slug}` và `/en/brands/{slug}`. `CONFIRMED_FROM_OWNER_DECISION` (2026-08-03)

**i18n cho DỮ LIỆU:** mọi request public/CMS truyền `lang` từ locale URL, gồm product, category, article, brand, menu, settings, slider và video. Backend giữ contract fallback EN→VI từng trường (`TRANSLATION_RULE_002` và các rule entity `_RULE_002`); web không thay cả record và không coi `slugEn` là điều kiện có nội dung EN. Lưới CSR đưa locale vào query key/request; nội dung ISR được server lấy sẵn theo locale, không refetch chỉ để đổi ngôn ngữ.

**Cấm:** dùng `force-dynamic` cho route không đọc dữ liệu theo request; với route đã được phân loại **Dynamic per request** ở trên thì đây là cấu hình bắt buộc. Không đọc `cookies()`/`headers()` để quyết định locale ở root layout hoặc trang cacheable. Dùng `useSearchParams()` trong component render ở trang tĩnh mà KHÔNG bọc `<Suspense>`.

## Documentation Architecture Rule

- `docs/business/` defines scope and behavior.
- `docs/engineering/` defines technical contracts and boundaries.
- `bigbike-openapi.json` is the machine-readable API companion — the contract, served at `/v3/api-docs`.
- `/v3/api-docs/live` (springdoc, developer machines only) is the generated cross-check, never the contract.
- Historical audits and phase reports are evidence only.
