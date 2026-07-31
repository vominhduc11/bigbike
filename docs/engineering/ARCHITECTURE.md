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
| Schema | Flyway versioned migrations (current repository through `V367`) plus dev seeds | `OWNER_CONFIRMED_2026-07-31` | `src/main/resources/db/migration`, `db/migration-dev` |
| Auth | Admin JWT + customer cookie/session auth | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, auth services/filters |
| Real-time | STOMP over WebSocket with simple broker | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java` |

### Notable architectural realities

- OpenAPI is a checked-in companion file, not an automatically trusted source without verification. `CONFIRMED_FROM_STRUCTURE`
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
| **ISR on-demand** (admin content) | Route động admin quản lý: `product/[slug]`, `brands/[slug]`, `danh-muc/[slug]`, `tin-tuc/[slug]` | `generateStaticParams()` trả **`[]`** → **KHÔNG prebuild/gọi API lúc build**; trang sinh khi truy cập lần đầu rồi cache, revalidate qua `next.tags` (`product:{slug}`, `category:{slug}`, `brand:{slug}`, `article:{slug}`…). (Trang thông tin/chính sách `gioi-thieu`/`lien-he`/`huong-dan*`/`chinh-sach/*`/catch-all `[slug]` **không** còn thuộc nhóm này — chuyển sang tĩnh, xem hàng dưới; module pages + guide-page gỡ 2026-06-24.) |
| **Static + ISR** (shell) | Trang chủ + các trang archive/list: `sp`, `tim-kiem`, `tin-tuc`, `brands`; **8 route thông tin/chính sách tĩnh**; các shell đăng nhập/đăng ký/quên mật khẩu, tài khoản, địa chỉ và đơn hàng cá nhân | Shell render tĩnh; dữ liệu admin (hero/settings) fetch với `next.tags` + revalidate on-demand. Các route info/policy đóng cứng trong web; không gọi backend CMS. `/lien-he` còn fetch `listPublicSettings` cho thông tin liên hệ dùng chung. `/chinh-sach/{slug}` chỉ build đúng 3 slug và tự dựng sidebar cố định; không đọc menu `policy`. Khu vực auth/tài khoản chỉ build shell; dữ liệu theo người dùng được lấy ở client sau khi đăng nhập. Hai segment động `tai-khoan/edit-address/[type]` và `tai-khoan/don-hang/[id]` dùng `force-static` + `generateStaticParams() = []`, không đọc session ở server. |
| **ISR revalidation** | Tất cả ở trên | Backend `WebRevalidationService` gọi `POST /api/revalidate` (`revalidateTag`) khi admin sửa nội dung/catalog. Checkout cũng có thể yêu cầu revalidate trang sản phẩm sau khi tạo đơn, nhưng đặt đơn **không tự đổi giá hay Còn/Hết** trong mô hình availability thủ công. |
| **CSR** | **PDP buy-box giá/tồn/biến thể** (`WpPurchaseSection` fetch `/api/products/[slug]/snapshot/` — mô tả/specs/ảnh vẫn ISR); lưới list lọc/phân trang/tìm (`WpCatalogClient`/`WpArticleListClient`/`WpBrandListClient`); giỏ hàng, đánh giá, auth, hồ sơ/địa chỉ, lịch sử/chi tiết đơn và tra cứu xác nhận đơn | React Query hoặc client API fetch sau khi shell tĩnh đã tải. Lưới có **skeleton** lần tải đầu (props ISR của PDP là giá trị ban đầu → PDP không cần skeleton). Dữ liệu cá nhân không được nhúng vào HTML cache chung. |
| **Dynamic (ƒ) hợp lệ** | Route handlers/API routes, gồm redirect tương thích `dat-hang/order-received/[id]` | Xử lý request/redirect ở server; không dùng cho page storefront hay trang tài khoản. |

**SSG thuần (fetch lúc build):** chỉ dùng cho dữ liệu tĩnh KHÔNG do admin quản lý. **Nội dung admin quản lý KHÔNG prebuild lúc build** — luôn ISR on-demand (`generateStaticParams` trả `[]`). Trang list giữ shell tĩnh + **lưới CSR** (không đọc `searchParams` ở server) để vừa tĩnh vừa lọc được mà không SSR.

**Nguyên tắc tách lớp ISR↔CSR (theo loại DỮ LIỆU, không theo trang):**
- **Cần SEO + ít đổi** (mô tả, ảnh, thông số, breadcrumb, metadata, carousel trang chủ, sản phẩm liên quan) → **ISR**; admin sửa → backend `revalidateTag` bust ngay.
- **Cần freshness cao, không cần SEO** (giá, badge "Còn hàng / Hết hàng") → **CSR** fetch sau khi page load. Áp dụng ở PDP buy-box (snapshot) + lưới browsing; KHÔNG CSR carousel trang chủ/sản phẩm liên quan (curated, ISR + revalidate là đủ tươi — tránh hại LCP/SEO).
- Điều kiện vận hành: ① backend phải gọi revalidate sau mỗi admin save (đã có — `WebRevalidationService`); ② lớp CSR có skeleton/fallback (lưới có skeleton; PDP dùng giá trị ISR ban đầu nên không cần).

**i18n & rendering:** mặc định locale `vi` render TĨNH ở server (`i18n/request.ts` chỉ đọc `locale` khi một trang tự truyền tường minh — KHÔNG đọc cookie/`requestLocale` qua `next/headers`, tránh ép mọi route còn lại thành dynamic/SSR). Đa số route (home, listing, static pages, brand) vẫn theo cơ chế cũ: server render `vi`, tiếng Anh xử lý ở CLIENT qua `ClientIntlProvider` (đọc cookie `NEXT_LOCALE` sau mount, nạp `messages/en.json`, swap không reload, không đổi URL).

**Từ 2026-07-24 — Sản phẩm/Danh mục/Bài viết có URL tiếng Anh THẬT** (`PRODUCT/CATEGORY/ARTICLE_RULE_003`; **thương hiệu vẫn là ngoại lệ, tên và slug dùng chung VI/EN** — `BRAND_RULE_001`/`BRAND_RULE_003`, không còn cột `slug_en` từ `V352`): khi `slugEn` có giá trị, tồn tại 1 route **riêng, thật sự server-render bằng `en`** (`app/products|categories|news/[slug]/page.tsx`) tại prefix khác route VI (`/products/`, `/categories/`, `/news/` so với `/product/`, `/danh-muc/`, `/tin-tuc/`). Route EN tự gọi `getTranslations({locale:"en", ...})`/fetch API với `lang="en"` tường minh — không phụ thuộc cookie — nên vẫn ISR/SSG-cacheable độc lập với route VI (mỗi URL 1 cache entry riêng, không đọc cookie/header động). Canonical mỗi route **tự trỏ về chính nó**; hreflang 2 route trỏ ngược nhau. Route EN chỉ chấp nhận đúng giá trị `slugEn` của bản ghi — lệch thì 404. `ClientIntlProvider` nhận diện 3 prefix EN-only qua `usePathname()` để tự chuyển khung giao diện (Header/Footer, `LText`/`Tr`) sang tiếng Anh mà không cần cookie; do dùng chung 1 `NextIntlClientProvider` cho toàn app, phần khung giao diện này chuyển sau khi hydrate (không có mismatch cứng, nhưng chưa server-render sẵn tiếng Anh như nội dung thực thể/`<head>`) — muốn triệt tiêu hoàn toàn cần tách nhiều root layout theo route groups (chưa làm, việc lớn riêng). Backend vẫn OR-resolve theo vi/en slug cho product/category/article (route VI/EN dùng chung nguồn dữ liệu này), route VI có guard tự `redirect()` sang route EN nếu lỡ bị truy cập bằng đúng giá trị `slugEn`. `timeZone` khai báo tường minh (`Asia/Ho_Chi_Minh`) để render tĩnh nhất quán. Từ 2026-07-29, archive sản phẩm VI dùng `/sp/`; `/san-pham/` là URL tương thích 301, còn `/sp/{slug}.html` tiếp tục là alias sản phẩm WordPress cũ. `CONFIRMED_FROM_CODE`

**i18n cho DỮ LIỆU (không chỉ chuỗi giao diện):** cùng nguyên tắc "tiếng Anh xử lý ở client, server giữ `vi` tĩnh" được áp cho cả nội dung admin quản lý:
- **Lưới/tìm kiếm (CSR)** — `WpCatalogClient`, `WpBrandListClient`, `WpArticleListClient`, gợi ý tìm kiếm (`SearchToggle` → `/api/search-suggest`) đọc `useLocale()` và đưa `lang` vào query + query key của React Query → đổi ngôn ngữ là refetch theo `lang`. Backend fallback EN→VI field-by-field (PRODUCT/CATEGORY/BRAND/ARTICLE `_RULE_002`).
- **Nội dung trang chi tiết (ISR)** — sản phẩm / bài viết / danh mục / thương hiệu bọc trong `LocalizedContentProvider` (`components/i18n/LocalizedContent.tsx`). Provider là client wrapper, **children vẫn do server render `vi`** (giữ HTML SEO canonical + ISR); khi locale ≠ `vi` nó refetch resource theo slug ở client (`client-api.fetchPublic*`) và đưa bản EN vào context. Các nút lá `LText` (chuỗi) / `LHtml` (rich-text, sanitize lại client) đổi field sang EN, fallback về `vi` đã render sẵn ở server → render đầu khớp server, không hydration mismatch. KHÔNG đọc cookie/SSR động, KHÔNG đổi URL.
- **Ngoại lệ:** nội dung curated của trang chủ (banner/Swiper, settings marketing) vẫn giữ `vi` (canonical SEO landing); nếu cần đổi sẽ mở rộng cùng cơ chế provider.

**Cấm:** `export const dynamic = "force-dynamic"` trên trang storefront (ép SSR, vô hiệu hoá ISR). Đọc `cookies()`/`headers()` ở root layout hoặc trang cacheable (ép toàn site dynamic). Dùng `useSearchParams()` trong component render ở trang tĩnh mà KHÔNG bọc `<Suspense>`.

## Documentation Architecture Rule

- `docs/business/` defines scope and behavior.
- `docs/engineering/` defines technical contracts and boundaries.
- `bigbike-openapi.json` is the machine-readable API companion.
- Historical audits and phase reports are evidence only.
