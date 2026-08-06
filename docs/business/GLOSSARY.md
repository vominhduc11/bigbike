# BigBike Glossary

## 1. Document Purpose

File này là từ điển thuật ngữ chính thức của BigBike. Mục tiêu là giúp business user, PM, BA, tester, developer mới và AI agent hiểu thống nhất các thuật ngữ nghiệp vụ, kỹ thuật và thuật ngữ phân tích được dùng trong dự án.

File này dùng để tránh hiểu sai khi viết docs, audit, test hoặc code. Đây không phải API contract, không phải database schema, không phải architecture detail, không phải requirement spec và không thay thế các tài liệu process/workflow/rule/state/test.

Nguyên tắc đọc file này:

- Thuật ngữ có evidence trong repo được đánh dấu rõ.
- Thuật ngữ chuẩn của phân tích phần mềm được phép đưa vào để thống nhất cách audit.
- Thuật ngữ chưa đủ evidence phải được đánh dấu cần xác nhận, không viết như đã chắc chắn.
- Không đưa secret, token, password, private key hoặc env value nhạy cảm.

## 2. Term Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_FROM_REPO` | Thuật ngữ xuất hiện rõ trong source/config/docs hiện có. |
| `STANDARD_ANALYSIS_TERM` | Thuật ngữ phân tích phần mềm chuẩn, dùng để tổ chức docs/audit/test. |
| `INFERRED_FROM_STRUCTURE` | Suy luận từ route/folder/API/entity/config naming nhưng chưa đủ để kết luận đầy đủ. |
| `DOCUMENTED_NEEDS_VERIFICATION` | Docs có nhắc nhưng code/source hiện audit chưa xác nhận đầy đủ. |
| `NEEDS_BUSINESS_CONFIRMATION` | Cần business xác nhận ý nghĩa/phạm vi chính xác. |
| `NOT_FOUND_IN_REPO` | Chưa thấy evidence trong repo hiện tại qua pass audit này. |

## 3. Quick Reference

| Term | Category | Short Meaning | Status | Related Docs |
|---|---|---|---|---|
| BigBike | Project Term | Nền tảng retail/D2C commerce cho motorcycle gear. | `CONFIRMED_FROM_REPO` | `PROJECT_OVERVIEW.md`, `README.md` |
| Public Web | Project Term | Website public SEO-first cho khách mua hàng. | `CONFIRMED_FROM_REPO` | `PROJECT_OVERVIEW.md`, `MODULE_CATALOG.md` |
| Admin Portal | Project Term | Dashboard nội bộ cho vận hành. | `CONFIRMED_FROM_REPO` | `MODULE_CATALOG.md`, `USER_ROLES.md` |
| Backend API | Project Term | Spring Boot REST API xử lý business/data/auth. | `CONFIRMED_FROM_REPO` | `PROJECT_OVERVIEW.md`, `API_CONTRACT.md` nếu có |
| Database | Project Term | PostgreSQL persistence qua JPA/Flyway. | `CONFIRMED_FROM_REPO` | `PROJECT_OVERVIEW.md`, `DATA_CONTRACT.md` nếu có |
| Product | Business Term | Sản phẩm bán trên BigBike. | `CONFIRMED_FROM_REPO` | `MODULE_CATALOG.md`, `BUSINESS_RULES.md` |
| Category | Business Term | Danh mục sản phẩm. | `CONFIRMED_FROM_REPO` | `MODULE_CATALOG.md`, `STATE_MACHINES.md` |
| Brand | Business Term | Thương hiệu sản phẩm. | `CONFIRMED_FROM_REPO` | `MODULE_CATALOG.md` |
| Customer | Role / Actor Term | Người dùng có tài khoản. | `CONFIRMED_FROM_REPO` | `USER_ROLES.md` |
| Guest / Visitor | Role / Actor Term | Người truy cập chưa đăng nhập. | `CONFIRMED_FROM_REPO` | `USER_ROLES.md` |
| Admin | Role / Actor Term | User nội bộ vận hành admin. | `CONFIRMED_FROM_REPO` | `USER_ROLES.md`, `PERMISSION_MATRIX.md` nếu có |
| Super Admin | Role / Actor Term | Admin quyền cao nhất, wildcard permission. | `CONFIRMED_FROM_REPO` | `USER_ROLES.md` |
| Order | Business Term | Đơn hàng được tạo từ cart checkout. | `CONFIRMED_FROM_REPO` | `BUSINESS_PROCESS.md`, `STATE_MACHINES.md` |
| Payment | Business Term | Phương thức COD hoặc chuyển khoản thủ công (`BANK_TRANSFER`) và payment records lịch sử; BACS chỉ còn ở đơn legacy. | `CONFIRMED_FROM_REPO` | `BUSINESS_PROCESS.md`, `STATE_MACHINES.md` |
| Shipping | Business Term | Giao hàng do shop tự sắp xếp, không có lựa chọn phương thức hay phí giao hàng cho khách. | `CONFIRMED_FROM_REPO` | `BUSINESS_RULES.md`, `WORKFLOW_OVERVIEW.md` |
| Inventory | Business Term | Tồn kho, stock state, stock movement. | `CONFIRMED_FROM_REPO` | `BUSINESS_PROCESS.md`, `STATE_MACHINES.md` |
| Return / Đổi trả | Business Term | Chính sách đổi/trả hàng cam kết thủ công với khách (không phải tính năng hệ thống). (Hệ thống xử lý đổi-trả/hoàn tiền đã gỡ 2026-06-23.) | `CONFIRMED_FROM_REPO` | `BUSINESS_RULES.md` |
| Media | Business Term | File/media asset cho product/content/homepage. | `CONFIRMED_FROM_REPO` | `MODULE_CATALOG.md` |
| Content | Business Term | Article/page/policy/guide CMS content. | `CONFIRMED_FROM_REPO` | `MODULE_CATALOG.md` |
| SEO | Business Term | Metadata, canonical, JSON-LD, redirects, sitemap/robots nếu có. | `CONFIRMED_FROM_REPO` một phần | `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md` |
| Module | Module / Feature Term | Nhóm chức năng lớn xuyên UI/API/data/rule/test. | `STANDARD_ANALYSIS_TERM` | `MODULE_CATALOG.md` |
| Feature | Module / Feature Term | Chức năng cụ thể trong module. | `STANDARD_ANALYSIS_TERM` | `MODULE_CATALOG.md` |
| Business Process | Workflow / Process Term | Quy trình vận hành nhìn từ business. | `STANDARD_ANALYSIS_TERM` | `BUSINESS_PROCESS.md` |
| Workflow End-to-End | Workflow / Process Term | Luồng hệ thống xuyên app/module/backend/database. | `STANDARD_ANALYSIS_TERM` | `WORKFLOW_OVERVIEW.md` |
| Business Rule | State / Rule Term | Luật nghiệp vụ bắt buộc, backend phải enforce nếu quan trọng. | `STANDARD_ANALYSIS_TERM` | `BUSINESS_RULES.md` |
| State Machine | State / Rule Term | Vòng đời trạng thái và allowed/forbidden transition. | `STANDARD_ANALYSIS_TERM` | `STATE_MACHINES.md` |
| API Contract | Technical Contract Term | FE gọi BE thế nào và BE trả gì. | `STANDARD_ANALYSIS_TERM` | `README.md`, `API_CONTRACT.md` nếu có |
| Data Contract | Technical Contract Term | Shape dữ liệu thống nhất xuyên app/module. | `STANDARD_ANALYSIS_TERM` | `README.md`, `DATA_CONTRACT.md` nếu có |
| Permission / RBAC | Permission / Security Term | Quyền truy cập theo role, backend enforce. | `CONFIRMED_FROM_REPO` | `USER_ROLES.md`, `BUSINESS_RULES.md` |
| Acceptance Criteria | Testing / Release Term | Điều kiện nghiệm thu/pass/done. | `STANDARD_ANALYSIS_TERM` | `ACCEPTANCE_CRITERIA.md` |
| Test Coverage | Testing / Release Term | Mức độ rule/flow được test thật. | `STANDARD_ANALYSIS_TERM` | `ACCEPTANCE_CRITERIA.md` |
| CI/CD | Testing / Release Term | Pipeline build/test/deploy tự động. | `STANDARD_ANALYSIS_TERM` | `ACCEPTANCE_CRITERIA.md` |
| Release Gate | Testing / Release Term | Điều kiện chặn release nếu build/test/lint fail. | `STANDARD_ANALYSIS_TERM` | `ACCEPTANCE_CRITERIA.md` |
| Payment Provider | Integration Term | Provider thanh toán ngoài hệ thống. | `NOT_FOUND_IN_REPO` | `BUSINESS_PROCESS.md` |
| Shipping Provider | Integration Term | Carrier ngoài như GHN/GHTK/ViettelPost nếu tích hợp. | `NOT_FOUND_IN_REPO` | `USER_ROLES.md` |
| Webhook | Integration Term | Callback server-to-server từ third-party. | `NOT_FOUND_IN_REPO` cho payment/shipping | `BUSINESS_RULES.md` |

## 4. Project Terms

### BigBike

| Field | Value |
|---|---|
| Category | Project Term |
| Definition | Nền tảng commerce/D2C retail cho đồ bảo hộ moto, biker gear và phụ kiện touring. |
| BigBike Context | Repo gồm public SEO-first sales website, internal admin dashboard, Spring Boot backend, Docker Compose infrastructure và design system. |
| Example | Khách xem sản phẩm trên public web, checkout tạo order; admin xử lý sản phẩm/đơn hàng trong admin portal. |
| Related Docs | `PROJECT_OVERVIEW.md`, `README.md`, `MODULE_CATALOG.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `README.md`, `docs/business/PROJECT_OVERVIEW.md` |

### Public Web

| Field | Value |
|---|---|
| Category | Project Term |
| Definition | Website public cho khách, ưu tiên SEO, product discovery, PDP, cart, checkout và content. |
| BigBike Context | App `bigbike-web` dùng Next.js App Router, route tiếng Việt như `/sp/`, `/gio-hang/`, `/thanh-toan/`. |
| Example | `/product/{slug}/`, `/danh-muc/{slug}/`, `/tin-tuc/{slug}/`. |
| Related Docs | `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `bigbike-web/lib/utils/routes.ts`, `README.md` |

### Admin Portal

| Field | Value |
|---|---|
| Category | Project Term |
| Definition | Dashboard nội bộ dùng để quản lý vận hành BigBike. |
| BigBike Context | App `bigbike-admin` là Vite + React SPA, có routes cho products, categories, brands, content, orders, customers, media, redirects, menus, sliders, shipping, reviews, admin-users, settings. |
| Example | `/admin/products` yêu cầu `products.read`; `/admin/orders` yêu cầu `orders.read`. |
| Related Docs | `USER_ROLES.md`, `MODULE_CATALOG.md`, `PERMISSION_MATRIX.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `bigbike-admin/README.md` |

### Backend API

| Field | Value |
|---|---|
| Category | Project Term |
| Definition | Spring Boot service expose REST API, enforce validation, auth, permission, business rules và persistence. |
| BigBike Context | Backend có public endpoints cho catalog/content/cart/checkout/search và admin endpoints dưới `/api/v1/admin/**`. |
| Example | `GET /api/v1/products`, `POST /api/v1/checkout`, `/api/v1/admin/**`. |
| Related Docs | `README.md`, `API_CONTRACT.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `SecurityConfig.java`, `CatalogController.java`, `CheckoutController.java` |

### Database

| Field | Value |
|---|---|
| Category | Project Term |
| Definition | Lớp lưu trữ dữ liệu chính của hệ thống. |
| BigBike Context | Repo dùng PostgreSQL, JPA và Flyway migrations. |
| Example | Order, Product, Category, Brand, Customer, Payment, Media được lưu qua backend persistence layer. |
| Related Docs | `PROJECT_OVERVIEW.md`, `DATA_CONTRACT.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `docker-compose.yaml`, `bigbike-backend/pom.xml`, `README.md` |

### Media Storage

| Field | Value |
|---|---|
| Category | Project Term / Integration Term |
| Definition | Storage object/file cho media assets. |
| BigBike Context | Docker Compose chạy MinIO; backend có MinIO/S3-compatible config và media module. |
| Example | Product image, gallery, article image, homepage slider assets. |
| Related Docs | `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `CONFIRMED_FROM_REPO` cho MinIO; CDN runtime `NEEDS_BUSINESS_CONFIRMATION` |
| Evidence | `docker-compose.yaml`, `AdminMediaController`, `MinioConfig` |

### Integration

| Field | Value |
|---|---|
| Category | Project Term / Integration Term |
| Definition | Kết nối với service ngoài hoặc infrastructure service ngoài business core. |
| BigBike Context | Confirmed: PostgreSQL, MinIO, email code path/config, Sentry/GTM references. Not confirmed: payment gateway webhook, shipping carrier provider. |
| Example | MinIO media storage là integration; Payment webhook chưa thấy evidence. |
| Related Docs | `WORKFLOW_OVERVIEW.md`, `BUSINESS_RULES.md` |
| Status | `CONFIRMED_FROM_REPO` một phần; external payment/shipping `NOT_FOUND_IN_REPO` |
| Evidence | `docker-compose.yaml`, `SecurityConfig.java`, `BUSINESS_PROCESS.md` |

### Deployment / Environment / Production / Local Development / Staging

| Field | Value |
|---|---|
| Category | Project Term |
| Definition | Các ngữ cảnh chạy hệ thống. |
| BigBike Context | Repo có Docker Compose, Spring profiles `dev`, `mock`, `prod`; local dev ports cho web/admin/backend/postgres/minio. `staging` chưa thấy evidence rõ. |
| Example | `SPRING_PROFILES_ACTIVE=prod`, local web port 3000, admin Docker port 4000, backend 8080. |
| Related Docs | `README.md`, `DEPLOYMENT_GUIDE.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` cho local/prod/dev/mock; `NOT_FOUND_IN_REPO` cho staging |
| Evidence | `README.md`, `docker-compose.yaml` |

## 5. Business Terms

### Product

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Sản phẩm BigBike bán cho khách. |
| BigBike Context | Product có slug, category, brand, price, media/spec/variant/stock/publish status theo các docs/code đã audit. |
| Example | Mũ bảo hiểm, găng tay, jacket, intercom/Bluetooth accessory. |
| Related Docs | `MODULE_CATALOG.md`, `BUSINESS_RULES.md`, `STATE_MACHINES.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `README.md`, `CatalogController.java`, `PublishStatus.java`, `ProductStockState.java` |

### Category

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Danh mục dùng để tổ chức catalog sản phẩm. |
| BigBike Context | Public category route/API tồn tại; admin quản lý category; visible category mới public. |
| Example | `/danh-muc/{slug}/`. |
| Related Docs | `MODULE_CATALOG.md`, `STATE_MACHINES.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `CatalogController.java`, `bigbike-web/lib/utils/routes.ts` |

### Brand

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Thương hiệu của sản phẩm. |
| BigBike Context | Public brand list/detail và admin brand management tồn tại. |
| Example | `/brands/{slug}/`. |
| Related Docs | `MODULE_CATALOG.md`, `BUSINESS_PROCESS.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `CatalogController.java`, `bigbike-web/lib/utils/routes.ts` |

### Customer

| Field | Value |
|---|---|
| Category | Business Term / Role Term |
| Definition | Người dùng có tài khoản BigBike. |
| BigBike Context | Customer có auth/account/address/order/return APIs và web account routes. |
| Example | Customer đăng nhập, xem `/tai-khoan/don-hang/`, tạo return cho order của mình. |
| Related Docs | `USER_ROLES.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `SecurityConfig.java` |

### Guest / Visitor

| Field | Value |
|---|---|
| Category | Business Term / Role Term |
| Definition | Người truy cập chưa đăng nhập. |
| BigBike Context | Có thể xem public catalog/content/search, dùng cart và checkout dạng guest. |
| Example | Guest gọi public product API hoặc checkout bằng guest cart. |
| Related Docs | `USER_ROLES.md`, `BUSINESS_PROCESS.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `SecurityConfig.java`, `CheckoutController.java` |

### Order

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Đơn hàng chính thức được tạo từ cart checkout. |
| BigBike Context | Order có một trục status, payment method/records, line items, shipping item, address snapshot, note và audit/notification side effects theo docs. |
| Example | Checkout mới chọn COD hoặc `BANK_TRANSFER` và tạo order ban đầu `PENDING`; trạng thái đi qua `PROCESSING` rồi `COMPLETED`. |
| Related Docs | `BUSINESS_PROCESS.md`, `WORKFLOW_OVERVIEW.md`, `STATE_MACHINES.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `CheckoutController.java`, `BUSINESS_PROCESS.md`, `STATE_MACHINES.md` |

### Order Item

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Dòng sản phẩm bên trong order. |
| BigBike Context | Checkout tạo line items/order items từ cart; dùng để lưu product snapshot và quantity. |
| Example | Một order có 2 mũ bảo hiểm và 1 đôi găng tay thì có nhiều order items. |
| Related Docs | `WORKFLOW_OVERVIEW.md`, `DATA_CONTRACT.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `CheckoutService` referenced by docs, `BUSINESS_PROCESS.md` |

### Payment

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Thông tin và trạng thái thanh toán của order. |
| BigBike Context | New storefront payment is internal/manual `COD` or `BANK_TRANSFER`; BACS is legacy-order compatibility only and no provider webhook exists. |
| Example | `UNPAID`, `PAID`, `CANCELLED` (`PARTIALLY_PAID`/`REFUNDED` đã gỡ). |
| Related Docs | `BUSINESS_PROCESS.md`, `BUSINESS_RULES.md`, `STATE_MACHINES.md` |
| Status | `CONFIRMED_FROM_REPO` cho internal/manual payment; external provider `NOT_FOUND_IN_REPO` |
| Evidence | `CheckoutService` docs, `STATE_MACHINES.md`, `BUSINESS_RULES.md` |

### Shipping

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Việc đưa đơn hàng đến địa chỉ khách. |
| BigBike Context | Shop tự sắp xếp giao hàng; storefront không cho chọn phương thức, không tính phí (`shippingAmount = 0`) và admin shipping zones/methods đã gỡ. Carrier integration/tracking tự động chưa có. |
| Example | Checkout hiển thị "Miễn phí vận chuyển" và lưu địa chỉ giao hàng, không tạo shipping-method item mới. |
| Related Docs | `BUSINESS_RULES.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `CONFIRMED_FROM_REPO` cho giao hàng thủ công/miễn phí; carrier `NOT_FOUND_IN_REPO` |
| Evidence | `BUSINESS_RULES.md` `SHIP_RULE_001`, `CheckoutService` |

### Inventory / Stock

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Inventory là quản lý tồn kho; Stock là **trạng thái có hàng** (boolean) của product/variant — không còn là số lượng (V261). |
| BigBike Context | Availability là cờ "Còn hàng / Hết hàng" admin tự bật/tắt. Checkout chặn theo `is_available` của biến thể. **Bán không tự đổi availability** — admin tự đánh dấu "Hết hàng" khi hết (không tự chặn bán quá). Không decrement/restore số lượng. |
| Example | `IN_STOCK`, `OUT_OF_STOCK` (`LOW_STOCK` đã gỡ khỏi enum, V279). |
| Related Docs | `BUSINESS_RULES.md`, `STATE_MACHINES.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `ProductStockState.java`, `BUSINESS_RULES.md` |

### Media

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | File/hình ảnh/tài nguyên dùng cho product, content, homepage, SEO. |
| BigBike Context | Admin media module hỗ trợ upload/list/update/delete/restore theo docs; MinIO là storage backend. |
| Example | Product gallery image, slider image, article image. |
| Related Docs | `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `docker-compose.yaml`, `MODULE_CATALOG.md` |

### Content / SEO

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Content là article/page/policy/guide; SEO là metadata/canonical/JSON-LD/redirect để hỗ trợ search visibility. |
| BigBike Context | Public web có article/page routes, homepage metadata/JSON-LD; redirects hỗ trợ legacy WordPress migration. |
| Example | `/tin-tuc/{slug}/`, canonical URL, LocalBusiness JSON-LD. |
| Related Docs | `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `CONFIRMED_FROM_REPO` một phần; sitemap/robots/per-page SEO `NEEDS_BUSINESS_CONFIRMATION` nếu cần scope chính xác |
| Evidence | `bigbike-web/lib/utils/routes.ts`, `PROJECT_OVERVIEW.md` |

### Return / Đổi trả

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Chỉ còn là chính sách đổi/trả hiển thị cho khách (các trang chính sách CMS — gồm cả "Chính sách bảo hành" — và dòng "Đổi size 30 ngày" theo từng sản phẩm) — một cam kết thủ công thực hiện ngoài hệ thống, KHÔNG phải tính năng được theo dõi trong hệ thống. (Hệ thống xử lý đổi-trả/hoàn tiền đã gỡ 2026-06-23; tính năng bảo hành cũng đã gỡ hẳn 2026-06-23, V264.) |
| BigBike Context | Khách đọc cam kết đổi/trả; shop thực hiện thủ công. Không còn yêu cầu đổi/trả, không còn vòng đời trạng thái, không còn hoàn tiền tự động trong hệ thống. |
| Example | Dòng "Đổi size 30 ngày" trên trang sản phẩm; nội dung chính sách đổi/trả trên trang chính sách CMS. |
| Related Docs | `BUSINESS_RULES.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | Per-product policy text; CMS policy pages |

### Report / Settings

| Field | Value |
|---|---|
| Category | Business Term |
| Definition | Report là báo cáo/dashboard/export; Settings là cấu hình vận hành site/app. |
| BigBike Context | Admin dashboard/report/settings/menu modules tồn tại. Metric semantics và sensitive public settings cần verify. |
| Example | Admin xem dashboard, export orders/customers/products; public web đọc settings/menu. |
| Related Docs | `MODULE_CATALOG.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `CONFIRMED_FROM_REPO` một phần; metric/sensitive behavior `NEEDS_BUSINESS_CONFIRMATION`/`DOCUMENTED_NEEDS_VERIFICATION` |
| Evidence | `MODULE_CATALOG.md`, `bigbike-admin/README.md` |

## 6. Role / Actor Terms

### Guest / Visitor

| Field | Value |
|---|---|
| Definition | Người truy cập public chưa đăng nhập. |
| BigBike Context | Browse product/content/search, dùng cart/checkout guest, order lookup. |
| Related Modules / Processes | Homepage, Catalog, Search, Cart, Checkout, Content. |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `SecurityConfig.java`, `USER_ROLES.md` |

### Customer

| Field | Value |
|---|---|
| Definition | Người dùng có tài khoản khách hàng. |
| BigBike Context | Đăng ký/đăng nhập, quản lý profile/address/order/return, checkout authenticated. |
| Related Modules / Processes | Customer Auth, Account, Orders, Returns, Checkout. |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `SecurityConfig.java`, `USER_ROLES.md` |

### Admin

| Field | Value |
|---|---|
| Definition | User nội bộ có quyền vận hành admin portal. |
| BigBike Context | Có permission map rộng nhưng không wildcard như Super Admin. |
| Related Modules / Processes | Products, Orders, Customers, Media, Content, Settings, Reports, Users/RBAC. |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `AdminRolePermissions.java`, `bigbike-admin/README.md` |

### Super Admin

| Field | Value |
|---|---|
| Definition | Admin quyền cao nhất, có wildcard permission `*`. |
| BigBike Context | Có guard không được tự demote hoặc demote Super Admin cuối cùng theo docs. |
| Related Modules / Processes | Users, Roles, Settings, all admin modules. |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `AdminRolePermissions.java`, `USER_ROLES.md` |

### Staff / Shop Manager / Editor / Author / Contributor / SEO Editor

| Field | Value |
|---|---|
| Definition | Các role nội bộ hoặc cách gọi nhân sự vận hành. |
| BigBike Context | `SHOP_MANAGER`, `EDITOR`, `AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR` xuất hiện trong role-permission map. `Staff` là term business-level generic, không thấy role exact `STAFF`. |
| Related Modules / Processes | Tùy role: shop ops, content/media, SEO/redirects. |
| Status | `CONFIRMED_FROM_REPO` cho named roles; `INFERRED_FROM_STRUCTURE` cho generic Staff |
| Evidence | `AdminRolePermissions.java`, `USER_ROLES.md` |

### System

| Field | Value |
|---|---|
| Definition | Actor kỹ thuật tự động thực hiện validation, persistence, stock movement, audit, notification, websocket. |
| BigBike Context | Checkout/order/return services tạo side effects thay cho human user. |
| Related Modules / Processes | Checkout, Orders, Inventory, Returns, Notification, Audit. |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `BUSINESS_PROCESS.md`, `WORKFLOW_OVERVIEW.md` |

### Payment Provider / Shipping Provider / Email Service / Media Storage or CDN

| Field | Value |
|---|---|
| Definition | Các actor/service ngoài hoặc infrastructure service tham gia workflow. |
| BigBike Context | Email Service và MinIO media storage có evidence. Payment Provider và Shipping Provider external chưa thấy evidence. CDN chỉ là runtime/public delivery possibility, chưa xác nhận. |
| Related Modules / Processes | Payment, Shipping/Fulfillment, Notification, Media. |
| Status | Email/MinIO `CONFIRMED_FROM_REPO`; Payment Provider/Shipping Provider `NOT_FOUND_IN_REPO`; CDN `NEEDS_BUSINESS_CONFIRMATION` |
| Evidence | `docker-compose.yaml`, `USER_ROLES.md`, search pass for payment/shipping provider found no evidence |

## 7. Module / Feature Terms

### Module

| Field | Value |
|---|---|
| Category | Module / Feature Term |
| Definition | Nhóm chức năng lớn phục vụ một mảng nghiệp vụ hoặc kỹ thuật rõ ràng. |
| BigBike Context | Module không chỉ là một page. Module có thể gồm route, screen, API, service, entity, permission, validation, business rule, state và test coverage. |
| Example | Products, Orders, Inventory, Media, Content, RBAC. |
| Related Docs | `MODULE_CATALOG.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `MODULE_CATALOG.md` |

### Feature

| Field | Value |
|---|---|
| Definition | Chức năng con cụ thể bên trong module. |
| BigBike Context | Feature phải được đánh giá theo scope UI/API/service/data/permission/test nếu có mutation/data thật. |
| Example | Product list, create product, publish product, update order status. |
| Related Docs | `MODULE_CATALOG.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `MODULE_CATALOG.md` |

### Screen / Page / Route / Component

| Field | Value |
|---|---|
| Definition | UI building blocks: route là đường dẫn, screen/page là màn hình, component là UI unit tái sử dụng. |
| BigBike Context | Public web routes nằm trong Next.js app/route helpers; admin screens nằm trong SPA. |
| Example | `/sp/`, `/admin/products`, `ProductDetailScreen`, `HeroSlider`. |
| Related Docs | `MODULE_CATALOG.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `bigbike-web/lib/utils/routes.ts`, `bigbike-admin/README.md` |

### Admin Module / Public Web Module / Backend Module / Shared Module

| Field | Value |
|---|---|
| Definition | Cách phân loại module theo layer. |
| BigBike Context | Admin Module phục vụ vận hành; Public Web Module phục vụ customer-facing; Backend Module xử lý API/business/data; Shared Module là cross-cutting như Security, Validation, Error Handling, Design System. |
| Example | Admin Orders, Public Checkout, Backend Inventory, Shared Security. |
| Related Docs | `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `MODULE_CATALOG.md` |

## 8. Process / Workflow Terms

### Business Process

| Field | Value |
|---|---|
| Definition | Quy trình nghiệp vụ nhìn từ góc vận hành doanh nghiệp. |
| BigBike Context | Mô tả business muốn đạt kết quả gì, actor nào tham gia, không nhồi implementation chi tiết. |
| Example | Cart / Checkout Process: khách chọn sản phẩm, nhập thông tin, tạo order. |
| Related Docs | `BUSINESS_PROCESS.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `BUSINESS_PROCESS.md` |

### Workflow End-to-End

| Field | Value |
|---|---|
| Definition | Luồng hệ thống chạy xuyên nhiều app/module/backend/database/integration để hỗ trợ business process. |
| BigBike Context | Checkout E2E đi qua Public Web, Cart, Checkout API, Order, Payment, Shipping, Inventory, Notification. |
| Example | Cart/Checkout/Order Creation Workflow. |
| Related Docs | `WORKFLOW_OVERVIEW.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `WORKFLOW_OVERVIEW.md` |

### Use Case / Main Flow / Alternative Flow / Error Flow

| Field | Value |
|---|---|
| Definition | Use Case là mục tiêu người dùng; Main Flow là luồng chuẩn; Alternative Flow là biến thể hợp lệ; Error Flow là luồng lỗi/reject. |
| BigBike Context | Dùng để viết test/acceptance cho checkout, order, return, admin operations. |
| Example | Main Flow checkout thành công; Error Flow checkout out-of-stock. |
| Related Docs | `WORKFLOW_OVERVIEW.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `WORKFLOW_OVERVIEW.md` |

### Side Effect / Start Point / End Point

| Field | Value |
|---|---|
| Definition | Start Point là nơi workflow bắt đầu; End Point là kết quả cuối; Side Effect là thay đổi phụ nhưng quan trọng. |
| BigBike Context | Checkout side effects gồm tạo order/payment/shipping item, trừ stock, ghi note, trigger notification/websocket. |
| Example | Admin update order status có side effect audit log và email. |
| Related Docs | `WORKFLOW_OVERVIEW.md`, `BUSINESS_RULES.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `WORKFLOW_OVERVIEW.md` |

## 9. Business Rule / State Terms

### Business Rule

| Field | Value |
|---|---|
| Definition | Luật nghiệp vụ bắt buộc mà hệ thống phải tuân thủ. |
| BigBike Context | Rule ảnh hưởng dữ liệu/trạng thái/payment/inventory/security phải backend enforce. Frontend hide/disable button chỉ hỗ trợ UX. |
| Example | Không checkout sản phẩm/biến thể đã được đánh dấu "Hết hàng"; order transition sai phải bị reject. |
| Related Docs | `BUSINESS_RULES.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `BUSINESS_RULES.md` |

### State Machine / State / Status / Transition

| Field | Value |
|---|---|
| Definition | State Machine mô tả các trạng thái hợp lệ và transition giữa chúng. State/Status là giá trị hiện tại; Transition là hành động đổi trạng thái. |
| BigBike Context | Product publish status, order status, payment-record status, media status, admin user status. |
| Example | Product `DRAFT -> PUBLISHED`; Order `PROCESSING -> COMPLETED`; payment record stores its own technical snapshot. |
| Related Docs | `STATE_MACHINES.md` |
| Status | `STANDARD_ANALYSIS_TERM` / status values `CONFIRMED_FROM_REPO` |
| Evidence | `PublishStatus.java`, `ProductStockState.java`, `STATE_MACHINES.md` |

### Allowed Transition / Forbidden Transition

| Field | Value |
|---|---|
| Definition | Allowed transition là chuyển trạng thái được phép; Forbidden transition là chuyển trạng thái bị cấm. |
| BigBike Context | Backend phải reject forbidden transition, không tin frontend. |
| Example | `CANCELLED -> PROCESSING` là forbidden theo order state machine hiện tại. |
| Related Docs | `STATE_MACHINES.md`, `BUSINESS_RULES.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `STATE_MACHINES.md` |

### Initial State / Terminal State / Precondition / Postcondition / Enforcement Layer

| Field | Value |
|---|---|
| Definition | Initial State là trạng thái ban đầu; Terminal State là trạng thái kết thúc; Precondition là điều kiện trước action; Postcondition là kết quả sau action; Enforcement Layer là nơi rule được kiểm soát. |
| BigBike Context | New COD or `BANK_TRANSFER` orders start `PENDING`; backend/service là enforcement layer cho order state, payment records và inventory. |
| Example | Publish precondition: product có đủ field bắt buộc; postcondition: product status `PUBLISHED`. |
| Related Docs | `STATE_MACHINES.md`, `BUSINESS_RULES.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `STATE_MACHINES.md`, `BUSINESS_RULES.md` |

## 10. API / Data Contract Terms

### API Contract

| Field | Value |
|---|---|
| Definition | Quy ước FE/client gọi backend bằng endpoint, method, auth, request, response, error format. |
| BigBike Context | Root README nói OpenAPI spec là full API contract; public/admin API phải không lệch với FE clients. |
| Example | `POST /api/v1/checkout` nhận checkout request và trả order summary. |
| Related Docs | `README.md`, `API_CONTRACT.md` nếu có |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `README.md`, `CheckoutController.java` |

### Data Contract

| Field | Value |
|---|---|
| Definition | Shape dữ liệu thống nhất xuyên app/module, không chỉ response của một endpoint. |
| BigBike Context | README xác định API JSON dùng camelCase, tiền dùng integer VND, canonical product media fields là `image.url`, `gallery[]`, `videos[]`. |
| Example | Tránh drift legacy `imageUrl`, `images`, `videoUrl`. |
| Related Docs | `README.md`, `DATA_CONTRACT.md` nếu có |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `README.md` |

### Request / Response / DTO

| Field | Value |
|---|---|
| Definition | Request là dữ liệu client gửi; Response là dữ liệu backend trả; DTO là object truyền dữ liệu giữa API layer và service/client. |
| BigBike Context | Backend có DTO như `CheckoutRequest`, `OrderSummaryResponse`, `ProductSnapshotResponse`. |
| Example | CheckoutController nhận `CheckoutRequest`, trả `OrderSummaryResponse`. |
| Related Docs | `API_CONTRACT.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `CheckoutController.java`, `CatalogController.java` |

### Entity / Data Model / Schema

| Field | Value |
|---|---|
| Definition | Entity/Data Model là đối tượng hệ thống quản lý/lưu trữ; Schema là cấu trúc database/API/data. |
| BigBike Context | Product, Order, Customer, Payment, Category, Brand, Media là data models/entity-level terms; chi tiết field không nhồi vào glossary. |
| Example | Product entity có publish status và stock state theo docs/code. |
| Related Docs | `DATA_CONTRACT.md`, `STATE_MACHINES.md` |
| Status | `STANDARD_ANALYSIS_TERM` / domain entities `CONFIRMED_FROM_REPO` |
| Evidence | `README.md`, `STATE_MACHINES.md` |

### Enum / Pagination / Error Format

| Field | Value |
|---|---|
| Definition | Enum là tập giá trị cố định; Pagination là phân trang; Error Format là shape lỗi chuẩn. |
| BigBike Context | PublishStatus/ProductStockState là enum; CatalogController có page/size/sort; README yêu cầu standard error shape. |
| Example | `PUBLISHED`, `OUT_OF_STOCK`; `page=1&size=20`; validation error. |
| Related Docs | `BUSINESS_RULES.md`, `API_CONTRACT.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `PublishStatus.java`, `ProductStockState.java`, `CatalogController.java`, `README.md` |

### Canonical Field / Legacy Field / Backward Compatibility

| Field | Value |
|---|---|
| Definition | Canonical Field là field chuẩn hiện tại; Legacy Field là field cũ cần tránh hoặc fallback; Backward Compatibility là giữ tương thích dữ liệu/URL cũ. |
| BigBike Context | Canonical media fields: `image.url`, `gallery[]`, `videos[]`; legacy: `imageUrl`, `images`, `videoUrl`. Legacy WordPress redirects/migration cũng thuộc backward compatibility. |
| Example | FE nên map về canonical fields và không tái tạo drift. |
| Related Docs | `README.md`, `DATA_CONTRACT.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `README.md` |

## 11. Permission / Security Terms

### Permission / RBAC / Role-Based Access Control

| Field | Value |
|---|---|
| Definition | Permission là quyền action cụ thể; RBAC là kiểm soát quyền theo role. |
| BigBike Context | Admin role-permission map có `SUPER_ADMIN`, `ADMIN`, `SHOP_MANAGER`, `EDITOR`, `AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR`; admin API yêu cầu `ROLE_ADMIN` và permission check theo module/action. |
| Example | `/admin/products` cần `products.read`; order mutation cần `orders.write`. |
| Related Docs | `USER_ROLES.md`, `PERMISSION_MATRIX.md` nếu có |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `AdminRolePermissions.java`, `SecurityConfig.java`, `bigbike-admin/README.md` |

### Authentication / Authorization

| Field | Value |
|---|---|
| Definition | Authentication xác định user là ai; Authorization xác định user được làm gì. |
| BigBike Context | Customer/admin auth endpoints tồn tại; admin endpoints yêu cầu role admin; customer protected APIs yêu cầu role customer. |
| Example | Login là authentication; `orders.write` là authorization. |
| Related Docs | `USER_ROLES.md`, `BUSINESS_RULES.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `SecurityConfig.java`, `USER_ROLES.md` |

### Admin Guard / Route Guard / Frontend Guard / Backend Enforcement

| Field | Value |
|---|---|
| Definition | Guard là cơ chế chặn truy cập/action. Frontend Guard chỉ hỗ trợ UX; Backend Enforcement là lớp bắt buộc. |
| BigBike Context | Frontend route guard redirect account/checkout nếu chưa authenticated; backend SecurityConfig vẫn là boundary thật. |
| Example | FE ẩn button delete không đủ; backend vẫn phải reject user thiếu permission. |
| Related Docs | `BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `STANDARD_ANALYSIS_TERM`; route guards `CONFIRMED_FROM_REPO` |
| Evidence | `SecurityConfig.java` |

### Permission Denied / Sensitive Data / Secret

| Field | Value |
|---|---|
| Definition | Permission Denied là lỗi thiếu quyền; Sensitive Data/Secret là dữ liệu không được expose như token/password/private key/env secret. |
| BigBike Context | README nhắc không commit DB password, JWT secrets, payment secrets, SMTP credentials, cloud storage credentials, admin passwords, API keys, webhook secrets. |
| Example | Không đưa env value nhạy cảm vào docs hoặc public frontend. |
| Related Docs | `README.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `README.md` |

## 12. Validation / Edge Case Terms

### Validation / Frontend Validation / Backend Validation

| Field | Value |
|---|---|
| Definition | Validation kiểm tra dữ liệu hợp lệ. Frontend validation giúp UX; Backend validation là bắt buộc cho dữ liệu/action thật. |
| BigBike Context | Checkout validate address/payment/shipping/stock; CatalogController validate slug, page/size, price range. |
| Example | `min_price <= max_price`; checkout không cho cart rỗng. |
| Related Docs | `BUSINESS_RULES.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `CONFIRMED_FROM_REPO` |
| Evidence | `CatalogController.java`, `CheckoutController.java`, `BUSINESS_RULES.md` |

### Edge Case / Negative Case / Positive Case

| Field | Value |
|---|---|
| Definition | Edge Case là trường hợp biên/dễ lỗi; Negative Case là case phải reject; Positive Case là happy path phải pass. |
| BigBike Context | Checkout out-of-stock, invalid transition, duplicate slug là negative/edge cases. |
| Example | Order `CANCELLED -> PROCESSING` phải fail. |
| Related Docs | `BUSINESS_RULES.md`, `STATE_MACHINES.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `ACCEPTANCE_CRITERIA.md` |

### Error Handling / Empty / Loading / Submitting / Success / Not Found / Fallback

| Field | Value |
|---|---|
| Definition | Các trạng thái UI/API cần xử lý để user flow không cụt. |
| BigBike Context | Acceptance Criteria yêu cầu UI data/action có loading, empty, error, submitting, success, permission-denied, not-found khi phù hợp. |
| Example | Product list không có item phải có empty state; checkout đang submit phải chống double-submit. |
| Related Docs | `ACCEPTANCE_CRITERIA.md`, `README.md` |
| Status | `STANDARD_ANALYSIS_TERM`; UI coverage `DOCUMENTED_NEEDS_VERIFICATION` |
| Evidence | `ACCEPTANCE_CRITERIA.md`, `README.md` |

## 13. Testing / Release Terms

### Test Coverage

| Field | Value |
|---|---|
| Definition | Mức độ code/rule/workflow được test bằng test thật và chạy trong gate phù hợp. |
| BigBike Context | Có test file chưa chắc có coverage nếu test không chạy trong CI/release gate. Nhiều docs đang đánh dấu `MISSING_TEST_COVERAGE`. |
| Example | Test invalid order transition, test checkout out-of-stock, test permission negative. |
| Related Docs | `ACCEPTANCE_CRITERIA.md`, `BUSINESS_RULES.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `ACCEPTANCE_CRITERIA.md` |

### Unit Test / Integration Test / E2E Test / Smoke Test / Regression Test / Permission Negative Test

| Field | Value |
|---|---|
| Definition | Các lớp test: unit kiểm tra đơn vị nhỏ; integration kiểm tra nhiều layer; E2E kiểm tra flow xuyên hệ thống; smoke kiểm tra sống/chết cơ bản; regression chống lỗi cũ tái xuất; permission negative test kiểm tra thiếu quyền bị reject. |
| BigBike Context | Cần cho checkout, order state, payment, inventory, RBAC, UI routes. |
| Example | Smoke: homepage loads, product detail loads, checkout validates fields. |
| Related Docs | `ACCEPTANCE_CRITERIA.md`, `README.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `README.md`, `ACCEPTANCE_CRITERIA.md` |

### Build / Lint / CI/CD / Release Gate

| Field | Value |
|---|---|
| Definition | Build tạo artifact; Lint kiểm style/static rule; CI/CD tự động test/build/deploy; Release Gate là điều kiện chặn release nếu chưa pass. |
| BigBike Context | Không được gọi production-ready nếu build/test/lint chưa pass. Repo có scripts/commands nhưng task này không chạy. |
| Example | Web/admin `npm run build`; backend `./mvnw test`; gate yêu cầu build/test/lint pass. |
| Related Docs | `README.md`, `ACCEPTANCE_CRITERIA.md` |
| Status | `STANDARD_ANALYSIS_TERM`; current run evidence `DOCUMENTED_NEEDS_VERIFICATION` |
| Evidence | `README.md`, `ACCEPTANCE_CRITERIA.md` |

### Acceptance Criteria / Definition of Done / Production-ready / Needs Verification

| Field | Value |
|---|---|
| Definition | Acceptance Criteria là tiêu chí pass; Definition of Done là bộ điều kiện để gọi done; Production-ready là đủ an toàn/vận hành để chạy thật; Needs Verification là chưa đủ bằng chứng. |
| BigBike Context | Module chỉ done khi UI/API/service/data/validation/permission/rules/tests/gates phù hợp với scope. |
| Example | Product module không done nếu public product filter pass nhưng UI/error states/test coverage chưa verify. |
| Related Docs | `ACCEPTANCE_CRITERIA.md` |
| Status | `STANDARD_ANALYSIS_TERM` |
| Evidence | `ACCEPTANCE_CRITERIA.md` |

## 14. Integration Terms

### Third-party Service / Integration

| Field | Value |
|---|---|
| Definition | Dịch vụ ngoài hoặc infrastructure service hệ thống kết nối để hoàn thành một phần workflow. |
| BigBike Context | Confirmed: PostgreSQL, MinIO, email config/code path, Sentry/GTM references. Not confirmed: payment provider/shipping carrier production integration. |
| Example | MinIO lưu media; Payment Provider chưa thấy trong repo. |
| Related Docs | `WORKFLOW_OVERVIEW.md`, `USER_ROLES.md` |
| Status | `CONFIRMED_FROM_REPO` một phần |
| Evidence | `docker-compose.yaml`, `README.md` |

### Webhook / Callback / Idempotency / Retry

| Field | Value |
|---|---|
| Definition | Webhook/Callback là request từ third-party về hệ thống; Idempotency giúp xử lý callback trùng không gây double update; Retry là thử lại khi thất bại. |
| BigBike Context | Payment/shipping webhook chưa thấy evidence. Đây là term chuẩn để đánh giá integration sau này, không được viết như đã implement. |
| Example | Payment webhook phải verify signature và idempotent nếu sau này tích hợp. |
| Related Docs | `BUSINESS_RULES.md`, `WORKFLOW_OVERVIEW.md` |
| Status | `STANDARD_ANALYSIS_TERM`; payment/shipping webhook `NOT_FOUND_IN_REPO` |
| Evidence | `BUSINESS_RULES.md` notes not found |

### Payment Provider / Shipping Provider / Email SMTP / CDN

| Field | Value |
|---|---|
| Definition | Provider thanh toán, vận chuyển, email và CDN/media delivery. |
| BigBike Context | Email SMTP config/code path có evidence; payment provider và shipping provider external chưa thấy; CDN chưa xác nhận runtime. |
| Example | COD và `BANK_TRANSFER` là payment method storefront nội bộ/manual; BACS chỉ còn trên đơn legacy, không phải payment gateway webhook. |
| Related Docs | `BUSINESS_PROCESS.md`, `USER_ROLES.md` |
| Status | Email `CONFIRMED_FROM_REPO`; payment/shipping provider `NOT_FOUND_IN_REPO`; CDN `NEEDS_BUSINESS_CONFIRMATION` |
| Evidence | `docker-compose.yaml`, `BUSINESS_PROCESS.md`, search pass no provider evidence |

### SEO / Sitemap / Robots.txt / Canonical URL / Redirect

| Field | Value |
|---|---|
| Definition | Nhóm thuật ngữ SEO technical: sitemap hỗ trợ discovery, robots kiểm crawl, canonical URL định URL chuẩn, redirect giữ URL legacy. |
| BigBike Context | Cả 4 đều đã triển khai và đang chạy. `app/sitemap.ts` phát URL VI+EN kèm hreflang, dựng theo request (`force-dynamic`) và **ném lỗi khi API hỏng** thay vì xuất bản bản thiếu. `app/robots.ts` chỉ chặn endpoint không render HTML được (`/api/`, `/admin/`, `/_internal/`) — xem `BUSINESS_RULES.md` rule `SEO_RULE_004`. Canonical tự sinh từ slug theo locale (`SEO_RULE_003`), không phải trường admin nhập. |
| Example | `toCanonicalUrl(path)` tạo canonical URL; legacy WordPress redirect map hỗ trợ SEO migration. |
| Related Docs | `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md`, `BUSINESS_RULES.md` (`SEO_RULE_001`–`SEO_RULE_005`) |
| Status | `CONFIRMED_FROM_REPO` (sitemap/robots xác minh 2026-08-06 bằng code + phản hồi HTTP thật) |
| Evidence | `bigbike-web/app/sitemap.ts`, `bigbike-web/app/robots.ts`, `bigbike-web/lib/utils/routes.ts`, `bigbike-web/__tests__/seo/` |

## 15. BigBike-Specific Terms

| Term | Meaning | Status | Evidence |
|---|---|---|---|
| `bigbike-web` | Public SEO/sales website bằng Next.js. | `CONFIRMED_FROM_REPO` | `README.md`, `bigbike-web/lib/utils/routes.ts` |
| `bigbike-admin` | Internal admin dashboard bằng Vite + React. | `CONFIRMED_FROM_REPO` | `README.md`, `bigbike-admin/README.md` |
| `bigbike-backend` | Spring Boot backend service. | `CONFIRMED_FROM_REPO` | `README.md`, `SecurityConfig.java` |
| `Bigbike Design System` | Brand/UI source of truth. | `CONFIRMED_FROM_REPO` | `README.md` |
| `PublishStatus` | Product/content publish lifecycle enum. | `CONFIRMED_FROM_REPO` | `PublishStatus.java` |
| `ProductStockState` | Product stock state enum. | `CONFIRMED_FROM_REPO` | `ProductStockState.java` |
| `SUPER_ADMIN` | Built-in admin role with wildcard permission. | `CONFIRMED_FROM_REPO` | `AdminRolePermissions.java` |
| `SHOP_MANAGER` | Built-in operational admin role. | `CONFIRMED_FROM_REPO` | `AdminRolePermissions.java` |
| `SEO_EDITOR` | Built-in role for content/redirect SEO work. | `CONFIRMED_FROM_REPO` | `AdminRolePermissions.java` |
| `COD` | Cash on delivery/manual payment method. | `CONFIRMED_FROM_REPO` | `BUSINESS_PROCESS.md`, `BUSINESS_RULES.md` |
| `BANK_TRANSFER` | New storefront bank-transfer/manual payment method; shop sends account details only after phone confirmation. | `CONFIRMED_FROM_REPO` | `BUSINESS_PROCESS.md`, `BUSINESS_RULES.md` |
| `BACS` | Legacy bank-transfer/manual payment method; không còn được chấp nhận cho đơn storefront mới. | `LEGACY_COMPATIBILITY` | `BUSINESS_PROCESS.md`, `BUSINESS_RULES.md` |
| MinIO | S3-compatible media storage in Docker stack. | `CONFIRMED_FROM_REPO` | `docker-compose.yaml` |
| PostgreSQL | Main relational database. | `CONFIRMED_FROM_REPO` | `docker-compose.yaml` |
| WordPress Migration | Legacy migration/redirect context. | `CONFIRMED_FROM_REPO` | `README.md`, `PROJECT_OVERVIEW.md` |

## 16. Common Confusions

| Term A | Term B | Difference |
|---|---|---|
| Module | Feature | Module là nhóm chức năng lớn; Feature là chức năng con cụ thể trong module. |
| Business Process | Workflow End-to-End | Business Process nhìn từ vận hành doanh nghiệp; Workflow E2E mô tả hệ thống chạy xuyên app/module/backend/database. |
| Business Rule | Business Logic | Business Rule là luật bắt buộc; Business Logic là implementation xử lý rule/flow trong code. |
| API Contract | Data Contract | API Contract là FE gọi BE và response/error thế nào; Data Contract là shape dữ liệu thống nhất xuyên app/module. |
| Role | Permission | Role là nhóm người/quyền; Permission là quyền action cụ thể. |
| Authentication | Authorization | Authentication xác định ai đang dùng; Authorization xác định được làm gì. |
| Validation | Business Rule | Validation kiểm input/format/state; Business Rule là luật nghiệp vụ có thể bao gồm validation nhưng rộng hơn. |
| State | Status | State là khái niệm trạng thái trong lifecycle; Status là field/value cụ thể lưu trong entity/API. Trong BigBike nhiều chỗ dùng status làm state field. |
| Test Coverage | Test Passed | Test Passed nghĩa là test hiện có chạy pass; Test Coverage hỏi rule/flow quan trọng đã được test đủ chưa. |
| Acceptance Criteria | Test Case | Acceptance Criteria là tiêu chí pass; Test Case là kịch bản cụ thể để kiểm tiêu chí đó. |
| UI | UX | UI là phần nhìn/thành phần giao diện; UX là trải nghiệm thao tác, flow, feedback, states. |
| Frontend Validation | Backend Validation | Frontend validation giúp user nhập đúng; backend validation là lớp bảo vệ bắt buộc. |
| Payment Method | Payment Provider | Payment Method storefront hiện tại là COD hoặc `BANK_TRANSFER`; BACS chỉ là dữ liệu legacy. Payment Provider là cổng/dịch vụ thanh toán ngoài hệ thống và hiện không dùng. |
| Shipping Method | Shipping Provider | Shipping Method đã gỡ khỏi checkout/admin; Shipping Provider là carrier bên thứ ba có API/tracking và hiện chưa tích hợp. |
| Canonical Field | Legacy Field | Canonical field là field chuẩn hiện tại; legacy field là field cũ/fallback cần tránh tái tạo drift. |

## 17. Ambiguous / Conflicting Terms

| Term | Where it appears | Conflict | Recommended canonical meaning | Needs verification |
|---|---|---|---|---|
| Staff | `USER_ROLES.md`, business docs | Business dùng generic Staff; role map không có exact `STAFF`. | Dùng `Staff` là business-level generic; technical roles là `SHOP_MANAGER`, `EDITOR`, `AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR`. | Business xác nhận cách gọi role nội bộ tiếng Việt. |
| Payment Provider / Payment Method | Business docs | Storefront dùng COD hoặc `BANK_TRANSFER`; external provider/webhook intentionally not used. | Payment Method mới là COD/`BANK_TRANSFER` internal/manual; BACS chỉ giữ tương thích đơn cũ. Payment Provider hiện không dùng. SePay auto-reconciliation đã bị bỏ (V59). | Đã chốt: không tích hợp cổng tự động. |
| Shipping Provider / Shipping Method | Business docs | Shipping method/admin module đã gỡ; carrier integration not found. | Shop tự sắp xếp giao hàng miễn phí; không có Shipping Method trong checkout. Shipping Provider là carrier external chưa tích hợp. | Business xác nhận GHN/GHTK/ViettelPost scope. |
| Staging | Prompt yêu cầu kiểm nếu có | Repo có dev/mock/prod; staging chưa thấy. | Không dùng staging như confirmed environment nếu chưa có config/deploy evidence. | Business/DevOps xác nhận có staging không. |
| `docs/DECISIONS.md` | README mentions | Direct fetch trong audit pass này không thấy file trên main. | Treat as planned/missing referenced doc until exists. | Kiểm tra path/branch hoặc tạo sau. |

## 18. Terms Not Confirmed In Repository

| Term | Category | Status | Notes |
|---|---|---|---|
| Payment Webhook | Integration Term | `NOT_FOUND_IN_REPO` | Không thấy payment webhook/provider controller/service trong audit/search pass này. |
| External Payment Provider | Integration Term | `NOT_FOUND_IN_REPO` | COD/`BANK_TRANSFER` manual payment confirmed; BACS chỉ là dữ liệu legacy, không phải external provider. |
| Shipping Provider | Integration Term | `NOT_FOUND_IN_REPO` | Không thấy GHN/GHTK/ViettelPost/carrier provider integration. |
| Carrier Tracking / Waybill | Integration Term | `NOT_FOUND_IN_REPO` | Shipping methods đã gỡ; fulfillment tracking/carrier automation chưa có. |
| Inventory Movement serial lifecycle | Business Term | `REMOVED` | Theo dõi theo số serial đã được gỡ toàn nền tảng (2026-06-23, V259). Tồn kho nay là Còn/Hết thủ công; không còn vòng đời serial hay số lượng. |
| Customer Account production readiness | Business Term | `DOCUMENTED_NEEDS_VERIFICATION` | Customer auth/account exists; production readiness/gates chưa được chứng minh trong docs này. |
| Audit Log completeness | Technical / Business Term | `DOCUMENTED_NEEDS_VERIFICATION` | Audit log exists, coverage every sensitive action needs matrix. |
| Staging Environment | Project Term | `NOT_FOUND_IN_REPO` | dev/mock/prod confirmed; staging not confirmed. |
| CDN | Integration Term | `NEEDS_BUSINESS_CONFIRMATION` | Media public/CDN runtime delivery chưa xác nhận. |
| Backup / Restore Workflow | Workflow Term | `NOT_FOUND_IN_REPO` | Workflow overview ghi chưa thấy evidence. |

## 19. Relationship With Other Docs

| Document | How it should use this glossary |
|---|---|
| `PROJECT_OVERVIEW.md` | Dùng glossary để thống nhất project terms như BigBike, Public Web, Admin Portal, Backend API, Environment. |
| `BUSINESS_PROCESS.md` | Dùng glossary cho process/business terms như Order, Payment, Shipping, Inventory, Return. |
| `MODULE_CATALOG.md` | Dùng glossary cho Module, Feature, Screen/Page/Route, Admin/Public/Backend Module. |
| `USER_ROLES.md` | Dùng glossary cho Actor, Role, Customer, Guest, Admin, Super Admin, System, Provider. |
| `WORKFLOW_OVERVIEW.md` | Dùng glossary cho Workflow End-to-End, Main Flow, Alternative Flow, Error Flow, Side Effect. |
| `BUSINESS_RULES.md` | Dùng glossary cho Business Rule, Enforcement Layer, Validation, Forbidden Behavior. |
| `STATE_MACHINES.md` | Dùng glossary cho State, Status, Transition, Allowed/Forbidden Transition, Initial/Terminal State. |
| `ACCEPTANCE_CRITERIA.md` | Dùng glossary cho Acceptance Criteria, Definition of Done, Test Coverage, Release Gate, Needs Verification. |
| `API_CONTRACT.md` | Dùng glossary cho API Contract, Request, Response, DTO, Error Format, Pagination. |
| `DATA_CONTRACT.md` | Dùng glossary cho Data Contract, Entity, Data Model, Schema, Enum, Canonical/Legacy Field. |
| `PERMISSION_MATRIX.md` | Dùng glossary cho RBAC, Role, Permission, Authorization, Backend Enforcement, Frontend Guard. |
| `TRACEABILITY_MATRIX.md` | Dùng glossary cho traceability terms: requirement/process/module/API/data/test/status. |

## Audit Notes

- File này được tạo bằng documentation/source audit pass, không chạy build/test/lint/runtime.
- Không sửa code, không refactor, không implement feature mới.
- Các evidence path trong file này là đường dẫn repo, không phải guarantee production readiness.
- Khi một thuật ngữ chưa chắc, giữ status `NEEDS_BUSINESS_CONFIRMATION`, `DOCUMENTED_NEEDS_VERIFICATION` hoặc `NOT_FOUND_IN_REPO` thay vì viết chắc như đã ship production.
