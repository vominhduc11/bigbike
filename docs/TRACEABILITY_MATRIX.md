# BigBike Traceability Matrix

Audit date: 2026-05-04

## 1. Document Purpose

File này nối business process, module, workflow, API, data contract, permission, rule/state, test và acceptance criteria của BigBike vào một matrix duy nhất.

Dành cho PM, BA, tester, developer và AI agent để biết phần nào đã có evidence, phần nào còn thiếu, phần nào cần verify trước release. Mục tiêu là tránh sửa mù, test mù và báo done bằng cảm xúc, thứ vốn không compile được.

Scope:

- Chỉ đọc/inspect repo, docs và source evidence.
- Không chạy build/test/deploy.
- Không sửa code, không refactor, không implement feature mới.
- Không tự bịa module/API/rule/test.
- Không ghi giá trị cấu hình nhạy cảm.

## 2. Traceability Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED` | Mapping có evidence rõ từ docs/source/config. |
| `PARTIAL` | Có evidence một phần nhưng còn thiếu UI/API/data/permission/test/runtime verification. |
| `BACKEND_ONLY` | Backend có, frontend/client/workflow UI chưa thấy rõ. |
| `FRONTEND_ONLY` | Frontend/client có, backend/API/service chưa thấy rõ. |
| `MISSING_API` | Có nhu cầu business/module/workflow nhưng chưa thấy API. |
| `MISSING_DATA_CONTRACT` | Chưa thấy canonical data contract đủ rõ. |
| `MISSING_PERMISSION` | Chưa thấy permission/backend guard/full matrix đủ rõ. |
| `MISSING_TEST` | Thiếu test hoặc test chưa đủ rõ. |
| `NEEDS_VERIFICATION` | Cần audit sâu hơn hoặc chạy runtime/build/test. |
| `CONFLICTING_EVIDENCE` | Docs/code/FE/BE có dấu hiệu lệch nhau. |
| `NOT_FOUND_IN_REPO` | Không thấy evidence tại path/source đã audit. |

## 3. High-Level Traceability Summary

| Business Area | Modules | Workflows | APIs | Data Contracts | Permissions | Tests | Overall Status |
|---|---|---|---|---|---|---|---|
| Product/catalog | Products, Categories, Brands, Media, SEO | Product management, publishing, public browse | Public + admin catalog APIs | Product, Category, Brand, ImageAsset, SeoMeta | `products.*`, `catalog.*`, `media.*` | Backend tests exist; transition/visibility matrix thiếu | `PARTIAL` |
| Public browsing/SEO | Homepage, PDP, Listing, Search, Content, Menu, Settings | Customer browsing, SEO discovery | Public catalog/content/search/menu/settings APIs | Product, Article, Page, Menu, Setting | Public read | Public API tests partial; SEO/responsive smoke thiếu | `PARTIAL` |
| Cart/checkout | Cart, Checkout, Coupon, Shipping, Payment, Inventory, Order | Cart checkout, quick-buy, order creation | Cart + checkout/options/quick-buy APIs | Cart, Checkout, OrderSummary, Payment, ShippingItem, StockMovement | Guest/customer + CSRF/session | Checkout tests historical/partial; concurrency thiếu | `PARTIAL` |
| Order/payment | Orders, Payment, Refund, Audit, Notification | Admin processing, payment update, refund, note | Admin order APIs | Order, Payment, Note, AuditLog | `orders.read/write` | Tests partial; state matrix thiếu | `PARTIAL` |
| Shipping | Shipping zones/methods, fulfillment | Shipping config, checkout selection | Admin shipping + checkout options | ShippingZone, ShippingMethod, OrderShippingItem | `shipping.read/write` | Direct shipping tests thiếu | `PARTIAL`; carrier `NOT_FOUND_IN_REPO` |
| Inventory | Inventory, stock, movements | Stock view/adjust/decrement/restore | Admin inventory + service side effects | StockItem, StockMovement | `products.read/update` | Inventory tests partial; concurrency/idempotency thiếu | `PARTIAL` |
| Returns | Customer/admin returns, refund, stock restore | Return create/list/status/refund | Customer return + admin return APIs | ReturnRequest, ReturnItem, ReturnHistory | customer scope, `orders.*` | Return tests partial; eligibility matrix thiếu | `PARTIAL` |
| Media | Media library, MinIO storage | Upload/list/update/delete/restore | Admin media APIs | MediaAsset, ImageAsset | `media.read/write` | Upload security tests thiếu | `PARTIAL` |
| Content/SEO | Articles, Pages, Redirects, Menu, Sliders | Publish content, public render, redirects | Admin/public content + redirect APIs | Article, Page, Redirect, SeoMeta | `content.*`, `redirects.*`, etc. | SEO migration smoke thiếu | `PARTIAL` |
| RBAC | Admin users, roles, permissions | Admin auth, role/user management | Auth/admin-users/roles APIs | AdminUser, Role, Permission | ROLE_ADMIN + module permissions | Auth tests partial; negative matrix thiếu | `PARTIAL`; `PERMISSION_MATRIX.md` missing |
| Reports | Dashboard, reports, exports | Metrics/export | Admin dashboard/report APIs | Aggregated metrics | mostly read permissions | Metric/export tests thiếu | `PARTIAL` |
| Runtime/integration | PostgreSQL, MinIO, mail, WS, Docker, CI | Deploy/runtime/notifications/media | healthchecks/internal services | config + domain events | infra/security filters | CI partial; compose smoke thiếu | `PARTIAL` |
| Mobile | Flutter app | Browse/cart/checkout/account/returns | Mobile endpoint constants map to shared APIs | Shared public/customer contracts | Customer auth/session | No mobile CI/test evidence | `PARTIAL` / `MISSING_TEST` |

## 4. Business Process → Module Matrix

| Business Process | Module(s) | Role(s) | Status | Evidence |
|---|---|---|---|---|
| Product Management Process | Products, Categories, Brands, Media, Inventory | Admin, Staff, Shop Manager | `CONFIRMED` for admin/backend; tests partial | `docs/business/BUSINESS_PROCESS.md`, `docs/business/MODULE_CATALOG.md`, `AdminCatalogController.java`, `bigbike-admin/src/App.jsx`, `bigbike-admin/src/lib/adminApi.js` |
| Product Publishing Process | Products, SEO, Public Catalog | Admin, System, Guest | `PARTIAL` | `AdminCatalogController.java`, `AdminCatalogMutationService.java`, `CatalogController.java`, `docs/business/STATE_MACHINES.md` |
| Customer Product Browsing Process | Homepage, Product Listing, PDP, Category, Brand, Search, Content | Guest, Customer | `CONFIRMED`; runtime smoke missing | `bigbike-web/lib/utils/routes.ts`, `bigbike-web/lib/api/public-api.ts`, `bigbike_mobile/lib/core/router/app_router.dart`, `SecurityConfig.java` |
| Cart / Checkout Process | Cart, Checkout, Orders, Payment, Shipping, Inventory, Coupons, Notification | Guest, Customer, System | `CONFIRMED` backend flow; tests partial | `CartController.java`, `CheckoutController.java`, `CheckoutService.java`, `client-api.ts`, `docs/API_FLOW_MAP.md` |
| Order Management Process | Orders, Payment, Audit, Notification, WebSocket, Inventory | Admin, Staff, System | `CONFIRMED`; transition tests partial | `AdminOrderController.java`, `AdminOrderService.java`, `adminApi.js`, `docs/API_FLOW_MAP.md` |
| Payment Handling Process | Payment, Orders, Refunds | Customer, Admin, System | `PARTIAL` | `CheckoutService.java`, `AdminOrderService.java`; external provider not found |
| Shipping / Fulfillment Process | Shipping, Checkout, Orders | Admin, Customer, System | `PARTIAL` | `AdminShippingController`, `CheckoutService.java`; carrier not found |
| Inventory Management Process | Inventory, Products, Orders, Returns | Admin, Staff, System | `CONFIRMED`; concurrency tests missing | `AdminInventoryController.java`, `CheckoutService.java`, `AdminOrderService.java`, `AdminReturnService.java` |
| Return / Refund Process | Returns, Orders, Payment, Inventory, Notification | Customer, Admin, System | `PARTIAL` | `CustomerOrderController.java`, `AdminReturnController.java`, `AdminReturnService.java`, `AdminOrderService.java` |
| Media Management Process | Media, Storage, Product/Content refs | Admin, Editor, Author | `CONFIRMED`; security tests missing | `AdminMediaController`, `AdminMediaService`, `MinioConfig`, `docker-compose.yaml` |
| Content / SEO Management Process | Articles, Pages, Redirects, Menus, Sliders, SEO | Admin, Editor, SEO Editor, Guest | `PARTIAL` | `AdminContentController`, `ContentController`, `InternalRedirectController`, `public-api.ts` |
| Admin User / Role / Permission Process | Admin Users, Roles, Security | Admin, Super Admin | `PARTIAL` | `AdminAdminUsersController`, `AdminRolesController`, `SecurityConfig.java`, `docs/business/USER_ROLES.md` |
| Reporting / Dashboard Process | Dashboard, Reports, Inventory Export | Admin, Manager | `PARTIAL` | `AdminDashboardController`, `AdminReportController`, `AdminInventoryController` |
| Settings / Configuration Process | Settings, Menus, Coupons | Admin, System, Guest | `PARTIAL` | `AdminSettingsController`, `PublicSettingsController`, `AdminMenuController`, `PublicMenuController`, `AdminCouponController` |
| Notification Process | Mail, WebSocket, Order/Return Events | System, Admin, Customer | `PARTIAL` | `OrderNotificationService`, `AdminOrderWsService`, `CheckoutService`, `AdminOrderService` |
| External Payment Webhook Process | Payment Provider | Third-party, System | `NOT_FOUND_IN_REPO` | No provider webhook controller/service found |
| Third-party Shipping Carrier Process | Carrier Integration | Third-party, Admin, System | `NOT_FOUND_IN_REPO` | Internal shipping only confirmed |

## 5. Module → Feature → Workflow Matrix

| Module | Feature | Workflow | Frontend | Backend | Status | Evidence |
|---|---|---|---|---|---|---|
| Homepage | Hero/categories/products/articles/brands/videos/settings | Customer Browsing | `bigbike-web/app/page.tsx` | Public APIs | `CONFIRMED` | `public-api.ts`, `CatalogController`, `PublicSettingsController` |
| Product Listing | list/filter/sort/search | Customer Browsing | Web/mobile routes | `CatalogController` | `CONFIRMED` | `routes.ts`, `app_router.dart`, `public-api.ts` |
| Product Detail | PDP/snapshot/reviews | Browse → Cart/Quick-buy | Web/mobile routes | `CatalogController`, review controllers | `PARTIAL` | product action wiring needs verification |
| Admin Products | list/detail/create/update/publish/delete | Product Management/Publishing | `App.jsx`, `adminApi.js` | `AdminCatalogController`, `AdminCatalogMutationService` | `CONFIRMED` | same paths |
| Categories/Brands | CRUD/visibility/public browse | Product Management/Browsing | admin/public/mobile routes | admin/public catalog controllers | `CONFIRMED` | `routes.ts`, `App.jsx`, `AdminCatalogController.java` |
| Cart | get/add/update/remove/clear/coupon | Cart Checkout | web client + mobile endpoints | `CartController`, `CartService` | `PARTIAL` | coupon behavior needs verification |
| Checkout | options/checkout/quick-buy | Order Creation | web client + mobile endpoints | `CheckoutController`, `CheckoutService` | `CONFIRMED` | `client-api.ts`, `api_endpoints.dart`, `CheckoutService.java` |
| Admin Orders | list/detail/status/payment/notes/refund | Admin Order Processing | admin route/client | `AdminOrderController`, `AdminOrderService` | `PARTIAL` | refund UI/client usage needs verification |
| Customer Account | auth/profile/address/orders/returns | Customer Account | web/mobile routes/client | customer controllers | `CONFIRMED` | `client-api.ts`, `app_router.dart`, `SecurityConfig.java` |
| Inventory | list/summary/movements/adjust/export | Inventory Management | admin route | `AdminInventoryController` | `CONFIRMED` | `App.jsx`, `AdminInventoryController.java` |
| Returns | customer return + admin return status | Return/Refund | web/mobile/admin routes | `CustomerOrderController`, `AdminReturnController` | `PARTIAL` | eligibility/payment sync needs verification |
| Media | upload/list/detail/update/delete/restore | Media Management | admin route/client | `AdminMediaController`, MinIO services | `PARTIAL` | security/runtime tests missing |
| Content | article/page CRUD/public render | Content/SEO | admin/public routes | content controllers | `PARTIAL` | SEO completeness missing |
| Redirects | admin/internal redirect | SEO Migration | admin route, web middleware expected | `AdminRedirectController`, `InternalRedirectController` | `PARTIAL` | redirect coverage missing |
| Settings/Menu/Coupon | admin config + public consumption | Settings | admin/public clients | settings/menu/coupon controllers | `PARTIAL` | sanitization/coupon checkout needs verification |
| Users/Roles | admin users/role permissions | RBAC | admin routes | admin user/role controllers | `PARTIAL` | `PERMISSION_MATRIX.md` missing |
| Reports/Dashboard | summary/analytics/export | Reporting | admin routes | dashboard/report controllers | `PARTIAL` | metric tests missing |
| Mobile App | Flutter routes/endpoints | Mobile workflows | `app_router.dart`, `api_endpoints.dart` | shared APIs | `PARTIAL` | no mobile CI/tests |

## 6. Workflow → API Matrix

| Workflow | Step | API / Controller | Service | Data Touched | Status | Evidence |
|---|---|---|---|---|---|---|
| Customer Browsing | Load homepage | public settings/menu/sliders/home-videos/products/categories/articles/brands | public read services | Setting, Menu, Slider, Product, Category, Article, Brand | `CONFIRMED` | `bigbike-web/app/page.tsx`, `public-api.ts`, `SecurityConfig.java` |
| Customer Browsing | Product list/detail | `CatalogController` | `CatalogReadService` | Product, Variant, Category, Brand | `PARTIAL` | public visibility filter needs verification |
| Product Management | Admin product CRUD/publish | `AdminCatalogController` | `AdminCatalogReadService`, `AdminCatalogMutationService` | Product, Price, SEO, Media refs | `CONFIRMED` | controller/service/admin client |
| Cart | Cart operations | `CartController` | `CartService` | Cart, CartItem, CartCoupon | `CONFIRMED` | `CartController.java`, `client-api.ts` |
| Checkout | options/checkout/quick-buy | `CheckoutController` | `CheckoutService` | Order, Payment, ShippingItem, StockMovement | `CONFIRMED` | `CheckoutController.java`, `CheckoutService.java` |
| Order Lookup | lookup order | `OrderLookupController` | order read service | OrderDetail | `CONFIRMED` | `public-api.ts`, `SecurityConfig.java`, `API_FLOW_MAP.md` |
| Customer Account | auth/profile/address/order/return | customer controllers | customer/order services | Customer, Address, Order, Return | `CONFIRMED` | `client-api.ts`, `CustomerOrderController.java`, `SecurityConfig.java` |
| Admin Orders | list/detail/status/payment/refund/note | `AdminOrderController` | `AdminOrderService` | Order, Payment, Note, Audit, StockMovement | `PARTIAL` | transition tests missing |
| Inventory | stock list/adjust/export | `AdminInventoryController` | `AdminInventoryService` | StockItem, StockMovement | `CONFIRMED` | `AdminInventoryController.java` |
| Returns | customer/admin returns | `CustomerOrderController`, `AdminReturnController` | `CustomerReturnService`, `AdminReturnService` | ReturnRequest, ReturnItem, History | `PARTIAL` | eligibility/refund consistency needs verification |
| Media | media lifecycle | `AdminMediaController` | media service, MinIO | MediaAsset/object storage | `PARTIAL` | upload security missing |
| Content/SEO | content CRUD/public read/redirect | content/redirect controllers | content/redirect services | Article, Page, Redirect, SeoMeta | `PARTIAL` | SEO migration tests missing |
| RBAC | admin users/roles/auth | auth/admin users/roles controllers | auth/RBAC services | AdminUser, Role, Permission | `PARTIAL` | standalone matrix missing |
| Reports | dashboard/export | dashboard/report controllers | report services | metrics/CSV | `PARTIAL` | metric semantics missing |
| Notifications | order/return events | internal service calls, `/ws/**` | notification/ws services | event/email payloads | `PARTIAL` | delivery/ws auth tests missing |

## 7. API → Data Contract Matrix

| API Area / Endpoint | Request Data | Response Data | Canonical Data Contract | Drift / Gap | Status | Evidence |
|---|---|---|---|---|---|---|
| Public catalog | query/filter params | Product/Category/Brand lists | Product, Category, Brand | product stock/FE drift noted | `PARTIAL` | `DATA_CONTRACT.md`, `API_CONTRACT.md`, `public-api.ts` |
| Product detail/snapshot | slug/id | Product/detail snapshot | Product, Variant, Price, Stock | publish filter needs verification | `PARTIAL` | `CatalogController`, `DATA_CONTRACT.md` |
| Public content/pages | slug/query | Article/Page | Article, Page, SeoMeta | public filtering/SEO tests missing | `PARTIAL` | `public-api.ts`, `DATA_CONTRACT.md` |
| Cart | item/coupon payloads | CartResponse | Cart, CartItem, CartTotals, CartCoupon | coupon drift needs verification | `PARTIAL` | `CartController.java`, `DATA_CONTRACT.md` |
| Checkout | CheckoutRequest/QuickBuyRequest | OrderSummary | Checkout, OrderSummary, Payment, Shipping | duplicate/concurrency tests missing | `PARTIAL` | `CheckoutService.java`, `DATA_CONTRACT.md` |
| Customer orders/returns | customer principal + ids | OrderDetail/Return | Order, ReturnRequest | eligibility/ownership tests partial | `PARTIAL` | `CustomerOrderController.java`, `DATA_CONTRACT.md` |
| Admin product/category/brand | upsert/publish payloads | Product/Category/Brand | catalog contracts | public/admin drift possible | `PARTIAL` | `AdminCatalogController.java`, `DATA_CONTRACT.md` |
| Admin order/payment/refund | status/payment/note/refund request | OrderDetail/Note/Transition | Order, Payment, Note, AuditLog | state tests missing | `PARTIAL` | `AdminOrderService.java`, `DATA_CONTRACT.md` |
| Admin inventory | filter/adjust | StockItem/Summary/Movement | StockItem, StockMovement | serial lifecycle incomplete | `PARTIAL` | `AdminInventoryController.java`, `DATA_CONTRACT.md` |
| Admin media | multipart/update/delete | MediaDetail/List | MediaAsset/ImageAsset | upload security tests missing | `PARTIAL` | `AdminMediaController`, `DATA_CONTRACT.md` |
| Settings/menu/coupon | admin/public payloads | Setting/Menu/Coupon | SiteSetting, Menu, Coupon | sanitization/coupon checkout drift | `PARTIAL` | `API_CONTRACT.md`, `TESTING_GUIDE.md` |
| Users/roles | user/role payloads | AdminUser/Role/Permission | AdminUser, Role, Permission | permission matrix missing | `PARTIAL` | `USER_ROLES.md`, `API_CONTRACT.md` |
| Reports | filters/export params | metrics/CSV | report contracts | metric formula undefined | `NEEDS_VERIFICATION` | `API_CONTRACT.md`, `TESTING_GUIDE.md` |

## 8. API / Action → Permission Matrix

`/docs/PERMISSION_MATRIX.md` was not found. This table uses `SecurityConfig`, admin route guard, controllers and role docs.

| Action | API / Route | Required Role | Required Permission | Backend Enforced | Frontend Guard | Status | Evidence |
|---|---|---|---|---|---|---|---|
| Public reads | public catalog/content/search/menu/settings | none | none | permitAll | public routes | `CONFIRMED` | `SecurityConfig.java`, `public-api.ts` |
| Cart | `/api/v1/cart/**` | guest/customer | CSRF on mutations | filters/controllers | web client CSRF | `CONFIRMED` | `SecurityConfig.java`, `CartController.java`, `client-api.ts` |
| Checkout | `/api/v1/checkout`, `/orders/quick-buy` | guest/customer | CSRF/session/service validation | filters/service | client headers | `CONFIRMED` | `SecurityConfig.java`, `CheckoutService.java` |
| Customer APIs | `/api/v1/customer/**` protected | `ROLE_CUSTOMER` | own scope | security + principal | auth guard | `CONFIRMED` | `SecurityConfig.java`, `CustomerOrderController.java`, `app_router.dart` |
| Admin products read | admin products GET | `ROLE_ADMIN` | `products.read` | yes | route permission | `CONFIRMED` | `AdminCatalogController.java`, `App.jsx` |
| Admin products mutate | admin products POST/PATCH/delete/publish | `ROLE_ADMIN` | `products.update` | yes | `canUpdate` | `CONFIRMED` | `AdminCatalogController.java`, `App.jsx` |
| Admin category/brand read | admin categories/brands GET | `ROLE_ADMIN` | `catalog.read` | yes | route permission | `CONFIRMED` | `AdminCatalogController.java`, `App.jsx` |
| Admin category/brand mutate | admin categories/brands mutation | `ROLE_ADMIN` | `catalog.update` | yes | `canUpdate` | `CONFIRMED` | `AdminCatalogController.java`, `App.jsx` |
| Admin orders read | admin order list/detail/transitions | `ROLE_ADMIN` | `orders.read` | yes | route permission | `CONFIRMED` | `AdminOrderController.java`, `App.jsx` |
| Admin orders mutate | status/payment/refund/note | `ROLE_ADMIN` | `orders.write` | yes | `canUpdate` | `CONFIRMED` | `AdminOrderController.java`, `AdminOrderService.java`, `App.jsx` |
| Inventory read/export | admin inventory GET/export | `ROLE_ADMIN` | `products.read` | yes | route permission | `CONFIRMED` | `AdminInventoryController.java`, `App.jsx` |
| Inventory adjust | adjust variant stock | `ROLE_ADMIN` | `products.update` | yes | `canUpdate` | `CONFIRMED` | `AdminInventoryController.java`, `App.jsx` |
| Returns read/update | admin returns GET/PATCH | `ROLE_ADMIN` | `orders.read/write` | yes | route permission | `CONFIRMED` | `AdminReturnController.java`, `App.jsx` |
| Media | admin media | `ROLE_ADMIN` | `media.read/write` | needs method-level audit | route permission | `PARTIAL` | `App.jsx`, `API_CONTRACT.md` |
| Content/redirects | admin content/redirects | `ROLE_ADMIN` | `content.*`, `redirects.*` | needs method-level audit | route permission | `PARTIAL` | `App.jsx`, `adminApi.js` |
| Settings/menu/coupon | admin settings/menu/coupon | `ROLE_ADMIN` | settings/menus/coupons read/write | needs method-level audit | route permission | `PARTIAL` | `App.jsx`, `adminApi.js` |
| Admin users/roles | admin users/roles | `ROLE_ADMIN` | `admin-users.read/write` | expected | route permission | `PARTIAL` | `USER_ROLES.md`, `App.jsx` |
| Reports/dashboard | admin dashboard/reports | `ROLE_ADMIN` | mostly read permissions | expected | route permission | `PARTIAL` | `App.jsx`, `API_CONTRACT.md` |
| WebSocket | `/ws/**` | authenticated admin expected | CONNECT token expected | HTTP permitAll; STOMP auth needs verify | connect after auth | `NEEDS_VERIFICATION` | `SecurityConfig.java`, `App.jsx` |

## 9. Business Rule → Enforcement → Test Matrix

| Rule ID | Rule Summary | Enforcement Component | Positive Test | Negative Test | Status | Evidence |
|---|---|---|---|---|---|---|
| PRODUCT_RULE_001 | Public catalog only returns `PUBLISHED` product | `CatalogReadService` | Needed | Needed | `MISSING_TEST` | `BUSINESS_RULES.md`, `TESTING_GUIDE.md` |
| PRODUCT_RULE_002 | Quick-buy only allows published product | `CheckoutService` | Needed | Needed | `MISSING_TEST` | `CheckoutService.java`, `BUSINESS_RULES.md` |
| PRODUCT_RULE_003 | Product required fields | DTO/service validation | Partial | Partial | `PARTIAL` | backend test files list, `BUSINESS_RULES.md` |
| PRODUCT_RULE_004 | Unique product/category/brand slug | catalog mutation service | Needed | Needed | `MISSING_TEST` | `BUSINESS_RULES.md` |
| CATEGORY_RULE_002 | Cannot hide category with visible children | catalog mutation service | Needed | Needed | `MISSING_TEST` | `BUSINESS_RULES.md` |
| CATEGORY_RULE_003 | No self/circular category parent | catalog mutation service | Needed | Needed | `MISSING_TEST` | `BUSINESS_RULES.md` |
| ORDER_RULE_001 | Checkout cannot use empty cart | `CheckoutService` | Historical/partial | Historical/partial | `PARTIAL` | `TESTING_GUIDE.md`, historical surefire report |
| ORDER_RULE_003 | Order status transition valid | `AdminOrderService` | Needed | Needed | `MISSING_TEST` full matrix | `STATE_MACHINES.md`, `AdminOrderService.java` |
| PAYMENT_RULE_001 | Checkout supports COD/BACS | `CheckoutService` | Historical/partial | Historical/partial | `PARTIAL` | `PHASE_1F...`, `TESTING_GUIDE.md` |
| PAYMENT_RULE_002 | Refund only paid/partial | `AdminOrderService` | Needed | Needed | `MISSING_TEST` | `BUSINESS_RULES.md` |
| PAYMENT_RULE_004 | External payment webhook authenticity/idempotency | Not found | N/A | N/A | `NOT_FOUND_IN_REPO` | no webhook evidence |
| SHIPPING_RULE_001 | Shipping method must exist/enabled | `CheckoutService` | Needed | Needed | `MISSING_TEST` | `BUSINESS_RULES.md` |
| INVENTORY_RULE_001 | No oversell/out-of-stock checkout | `CheckoutService` | Needed | Needed, especially concurrency | `MISSING_TEST` | `TESTING_GUIDE.md` |
| RETURN_RULE_001 | Customer return own order only | `CustomerReturnService` | Needed | Needed | `PARTIAL` | `CustomerOrderController.java` |
| MEDIA_RULE_001 | Upload whitelist | `AdminMediaService` | Needed | Needed | `MISSING_TEST` | `TESTING_GUIDE.md` |
| CONTENT_RULE_001 | Content type/status validation | content controller/service | Needed | Needed | `MISSING_TEST` | `BUSINESS_RULES.md` |
| RBAC_RULE_001 | Guest/customer cannot admin APIs | `SecurityConfig` | Partial | Needed full matrix | `PARTIAL` | `SecurityConfig.java`, `TESTING_GUIDE.md` |
| SETTINGS_RULE_001 | Public settings no sensitive exposure | public settings service/controller | Needed | Needed | `NEEDS_VERIFICATION` | `TESTING_GUIDE.md` |

## 10. State Machine → API / Service → Test Matrix

| Entity | Transition | API / Action | Service Enforcement | Side Effects | Test Coverage | Status | Evidence |
|---|---|---|---|---|---|---|---|
| Product | publish/hide/archive/trash/restore | admin product publish/delete | validators + catalog mutation | public visibility | full matrix missing | `MISSING_TEST` | `STATE_MACHINES.md` |
| Category | visible/hidden + tree rules | admin category update/delete | catalog mutation | public visibility | missing | `MISSING_TEST` | `STATE_MACHINES.md` |
| Brand | visible/hidden | admin brand update/delete | catalog mutation | public visibility | missing | `MISSING_TEST` | `STATE_MACHINES.md` |
| Order | allowed status transitions | admin order status API | `AdminOrderService` | timestamps, audit, notification, stock restore | partial | `PARTIAL` | `STATE_MACHINES.md` |
| Order | terminal outbound forbidden | admin order status API | `AdminOrderService` | reject | missing full matrix | `MISSING_TEST` | `STATE_MACHINES.md` |
| Payment | paid/partial/refunded/cancelled transitions | admin payment/refund APIs | `AdminOrderService` | paid/refund fields, payment record | missing full matrix | `MISSING_TEST` | `STATE_MACHINES.md` |
| Shipping | method selection/auto-select | checkout | `CheckoutService` | shipping item/amount | missing | `MISSING_TEST` | `STATE_MACHINES.md` |
| Fulfillment | tracking/status lifecycle | unknown | no transition map confirmed | unknown | none | `NEEDS_VERIFICATION` | `STATE_MACHINES.md` |
| Inventory | quantity/stock state changes | checkout/adjust/refund/return | inventory/checkout/order/return services | StockMovement | partial; concurrency missing | `PARTIAL` | `TESTING_GUIDE.md` |
| Return | pending/approved/rejected/received/completed/refunded | admin return status | `AdminReturnService` | history, notification, stock restore | full matrix missing | `MISSING_TEST` | `STATE_MACHINES.md` |
| Admin User | status/role changes | admin users APIs | admin users service | access governance | partial | `PARTIAL` | `USER_ROLES.md`, `TESTING_GUIDE.md` |
| Content | publish/archive visibility | admin content APIs | content service/validators | publishedAt/revalidation | missing | `MISSING_TEST` | `STATE_MACHINES.md` |
| Media | active/inactive/deleted/restore | admin media APIs | media service | object metadata/delete/restore | missing | `MISSING_TEST` | `TESTING_GUIDE.md` |

## 11. Acceptance Criteria → Evidence Matrix

| Criteria Area | Criteria | Evidence | Current Status | Gap |
|---|---|---|---|---|
| Global gates | build/lint/test gates before release | package files, pom, CI, `TESTING_GUIDE.md` | `PARTIAL` | no fresh run; mobile/E2E missing |
| Product | CRUD/publish/public visibility | catalog controllers/services, acceptance docs | `PARTIAL` | transition/public visibility tests missing |
| Category/Brand | CRUD/visibility/tree rules | catalog controller/rules docs | `PARTIAL` | negative tests missing |
| Public Web | browsing + SEO basics | web routes/homepage/public API | `PARTIAL` | responsive/SEO smoke missing |
| Cart/Checkout | cart/order/payment/shipping/stock | cart/checkout controllers/services | `PARTIAL` | concurrency, duplicate submit, coupon matrix missing |
| Orders | admin lifecycle/payment/refund/notes | order controller/service | `PARTIAL` | state/refund/payment tests missing |
| Payment | COD/BACS/internal refund | checkout/order services | `PARTIAL` | external provider missing |
| Shipping | internal zones/methods | shipping controller/checkout service | `PARTIAL` | carrier/tracking missing |
| Inventory | stock/movement/decrement/restore | inventory/order/return services | `PARTIAL` | concurrency/idempotency missing |
| Returns | customer/admin return | customer/admin return controllers | `PARTIAL` | eligibility/refund consistency tests missing |
| Media | upload/lifecycle | media controller/service/MinIO | `PARTIAL` | upload security tests missing |
| Content/SEO | article/page/redirect/public render | content/redirect docs/source | `PARTIAL` | SEO migration completeness missing |
| RBAC | backend-enforced permissions | security/admin routes/roles docs | `PARTIAL` | permission matrix + negative tests missing |
| Reports | dashboard/export | report/dashboard controllers | `PARTIAL` | metric semantics/tests missing |
| Mobile | Flutter companion | router/endpoints/pubspec | `PARTIAL` | no CI/test/build gate |

## 12. Integration Traceability

| Integration | Used By Workflow | API/Service | Config | Tests | Status | Evidence |
|---|---|---|---|---|---|---|
| PostgreSQL | backend persistence | JPA/Flyway services | `docker-compose.yaml`, `pom.xml` | Maven verify CI + schema tests | `CONFIRMED` | compose, pom, ci, testing guide |
| MinIO | media storage | media service/config | compose + MinIO config | media upload tests missing | `PARTIAL` | `docker-compose.yaml`, `DATA_CONTRACT.md` |
| Mail | order/return/auth notifications | notification services | backend/compose config names | delivery/failure tests missing | `PARTIAL` | `pom.xml`, `docker-compose.yaml`, service calls |
| WebSocket | admin realtime order events | admin WS + backend WS service | `/ws/**` | WS auth/event tests missing | `PARTIAL` | `SecurityConfig.java`, `App.jsx` |
| Payment provider | payment automation | not found | not found | none | `NOT_FOUND_IN_REPO` | docs/source audit |
| Shipping carrier | tracking/waybill | not found | not found | none | `NOT_FOUND_IN_REPO` | docs/source audit |
| Sentry/GTM | analytics/observability | frontend deps/env | package/compose refs | no smoke | `NEEDS_VERIFICATION` | `PROJECT_OVERVIEW.md`, compose/package |
| Docker Compose | runtime stack | services/healthchecks | `docker-compose.yaml` | compose smoke missing | `PARTIAL` | `TESTING_GUIDE.md` |
| GitHub Actions | CI gate | backend/web/admin jobs | `.github/workflows/ci.yml` | mobile/E2E/coverage missing | `PARTIAL` | `ci.yml` |

## 13. Deployment / Release Traceability

`docs/DEPLOYMENT_GUIDE.md` was not found. Deployment trace is derived from CI and Docker Compose.

| Component | Build Command | Runtime Config | Health Check | Test Gate | Status | Evidence |
|---|---|---|---|---|---|---|
| Backend | `./mvnw -B clean verify`, Docker build in CI | Spring profile, DB, JWT, MinIO, CORS, mail config names | `/actuator/health` | Maven verify | `CONFIRMED`; deploy guide missing | `ci.yml`, `docker-compose.yaml`, `pom.xml` |
| Web | `npm ci`, `npm run lint`, `npm run build`, Docker build | API/site/revalidate/analytics config names | HTTP `/` | lint/build; tests not CI-wired | `PARTIAL` | `ci.yml`, compose, package |
| Admin | `npm ci`, `npm run lint`, `npm run build`, Docker build | Vite build args/API base/mock flag | HTTP `/` | lint/build only | `PARTIAL` | `ci.yml`, compose, package |
| Mobile | no CI build found | needs verification | none | no job | `MISSING_TEST` | `pubspec.yaml`, `TESTING_GUIDE.md` |
| PostgreSQL | image service | DB env + volume | `pg_isready` | backend CI service | `CONFIRMED` | compose, ci |
| MinIO | image service | bucket/media config names | MinIO live health | media tests missing | `PARTIAL` | compose |
| Full stack smoke | recommended compose up | compose env required | healthchecks exist | not CI-wired | `RECOMMENDED_NOT_IMPLEMENTED` | `TESTING_GUIDE.md` |
| Backup/restore | not documented | not found | not found | no restore drill | `NOT_FOUND_IN_REPO` | deployment guide missing |

## 14. Test Coverage Traceability

| Module / Workflow | Required Tests | Existing Tests / Reports | Missing Tests | Risk | Status |
|---|---|---|---|---|---|
| Product publish | transitions, public visibility, invalid data | backend test files exist | full matrix | product leak/invalid product | `MISSING_TEST` |
| Category/Brand | visibility/tree/slug | backend tests partial | negative matrix | taxonomy break | `MISSING_TEST` |
| Public browse/SEO | route render, metadata, redirects | public API tests exist | SEO/responsive smoke | traffic/runtime break | `MISSING_TEST` |
| Cart | guest/customer cart, item/coupon ops | `Phase1ECartApiTest` listed | coupon/merge/ownership | cart corruption | `PARTIAL` |
| Checkout | COD/BACS, validation, stock, price | `Phase1FCheckoutApiTest` listed + historical report | concurrency/duplicate/coupon | oversell/duplicate order | `PARTIAL` |
| Admin Orders | lifecycle/payment/refund/note | `Phase1HAdminOrderApiTest` listed | full state/payment matrix | invalid order/payment state | `PARTIAL` |
| Shipping | internal methods/checkout selection | unclear | disabled/multiple/carrier tests | wrong shipping cost/status | `MISSING_TEST` |
| Inventory | stock adjust/decrement/restore | inventory test listed | concurrency/idempotency | oversell/double restore | `PARTIAL` |
| Returns | customer/admin transitions | return test listed | eligibility/refund consistency | invalid returns | `PARTIAL` |
| Media | upload lifecycle/security | media copy tests exist | MIME/size/storage failure | unsafe/broken media | `MISSING_TEST` |
| Content/SEO | publish/public/redirect | redirect tests listed | sitemap/robots/SEO smoke | SEO migration loss | `MISSING_TEST` |
| RBAC | auth boundaries/permissions | auth/security tests listed | full negative permission matrix | privilege escalation | `PARTIAL` |
| Settings/Menu/Coupon | public/private settings, coupon application | Phase 1J evidence | public sanitization/coupon checkout | config leak/discount bug | `PARTIAL` |
| Reports | metrics/export | not clear | formula/export/performance | wrong reporting | `MISSING_TEST` |
| Mobile | analyze/test/build/smoke | none found | all mobile CI/tests | app regressions | `MISSING_TEST` |
| Docker/runtime | compose health/restart | healthchecks exist | compose smoke + backup restore | deploy failure/data loss | `MISSING_TEST` |

## 15. Critical Gaps Before Release

| Gap | Affected Area | Risk | Required Fix / Verification | Priority | Evidence |
|---|---|---|---|---|---|
| Missing transition tests | Product, Order, Payment, Return, Media, Content | invalid state corrupts data | add positive/negative transition tests | Critical | `STATE_MACHINES.md`, `TESTING_GUIDE.md` |
| Missing permission negative tests | RBAC/admin/customer isolation | privilege/data leak | create permission matrix + 401/403 tests | Critical | `SecurityConfig.java`, `App.jsx`, `USER_ROLES.md` |
| External payment not found | Payment automation | manual-only payment or unsafe future webhook | confirm scope; if added, document and test signed/idempotent flow | High | `BUSINESS_PROCESS.md`, `TESTING_GUIDE.md` |
| External shipping not found | Fulfillment/tracking | no automated waybill/tracking | confirm scope or implement/docs/tests | High | shipping docs/source evidence |
| CI incomplete | Release gate | behavior can fail after build passes | add web tests/coverage, mobile job, E2E smoke | High | `ci.yml`, `TESTING_GUIDE.md` |
| Production auth needs verification | Auth/RBAC | insecure/incomplete auth behavior | verify real prod auth/session/logout/disabled user behavior | Critical | `USER_ROLES.md`, `SecurityConfig.java` |
| UI state audit missing | Public/admin/mobile | blank/error UX | audit loading/empty/error/submitting/permission states | High | `ACCEPTANCE_CRITERIA.md`, `TESTING_GUIDE.md` |
| API/data contract drift | FE/admin/mobile/backend | client/backend mismatch | sync data/API contracts and clients | High | `DATA_CONTRACT.md`, `API_CONTRACT.md` |
| Public settings sanitization | Public config API | sensitive config exposure | verify whitelist + tests | Critical | `TESTING_GUIDE.md` |
| SEO migration completeness | WordPress migration/redirects | SEO traffic loss | audit URL map, redirects, sitemap, robots, canonical | High | `API_FLOW_MAP.md`, `PROJECT_OVERVIEW.md` |
| Backup/restore missing | Ops/deployment | data/media loss | create deployment guide + restore drills | Critical | `DEPLOYMENT_GUIDE.md` not found |
| Compose smoke missing | Deployment | stack fails after CI | add compose up health smoke | High | `docker-compose.yaml`, `TESTING_GUIDE.md` |
| Media upload security missing | Media | unsafe uploads | add MIME/content/size/storage failure tests | High | `TESTING_GUIDE.md` |
| Checkout concurrency missing | Checkout/inventory | overselling stock | add concurrent integration tests | Critical | `CheckoutService.java`, `TESTING_GUIDE.md` |
| Report formulas missing | Reports | wrong business decisions | define and test metric formulas | Medium-High | `TESTING_GUIDE.md`, `API_CONTRACT.md` |

## 16. AI Agent Implementation Guidance

- Nếu sửa feature, cập nhật `TRACEABILITY_MATRIX.md` và docs liên quan.
- Không sửa frontend-only rồi gọi done nếu backend/API/data contract còn thiếu.
- Không enforce business rule chỉ ở UI. Rule liên quan data/payment/inventory/security phải enforce ở backend/service/domain.
- API mới phải cập nhật `API_CONTRACT.md`, `API_FLOW_MAP.md`, `DATA_CONTRACT.md`, permission mapping và matrix này.
- State/transition mới phải cập nhật `STATE_MACHINES.md`, `BUSINESS_RULES.md`, `TESTING_GUIDE.md`, acceptance criteria và tests.
- Permission mới phải cập nhật `PERMISSION_MATRIX.md` khi file đó được tạo, admin route guard, backend guard và negative tests.
- Data field dùng xuyên web/admin/mobile/backend phải cập nhật `DATA_CONTRACT.md` và client normalizer/contracts.
- Release/deploy change phải cập nhật `DEPLOYMENT_GUIDE.md`, `TESTING_GUIDE.md` và CI/CD gate.
- Integration mới phải cập nhật `INTEGRATION_GUIDE.md`, config docs, failure-mode tests và security requirements.
- Khi docs/code mâu thuẫn, đánh dấu `CONFLICTING_EVIDENCE`, không chọn đại cái nghe có vẻ doanh nghiệp hơn.

## 17. Evidence Summary

| Area | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| User task | Uploaded prompt text | Required structure, constraints and audit target for this file. | High |
| Project overview | `docs/business/PROJECT_OVERVIEW.md` | System context and scope caveats. | High, with older claims superseded by newer docs where applicable |
| Business processes | `docs/business/BUSINESS_PROCESS.md` | Process list and process-system mapping. | High |
| Module catalog | `docs/business/MODULE_CATALOG.md` | Module inventory and feature map. | High |
| User roles | `docs/business/USER_ROLES.md` | Actors, roles, system actors and RBAC context. | High |
| Workflow overview | `docs/business/WORKFLOW_OVERVIEW.md` | End-to-end workflow definitions. | High |
| Business rules | `docs/business/BUSINESS_RULES.md` | Rule IDs, enforcement and test gaps. | High |
| State machines | `docs/business/STATE_MACHINES.md` | Entity transitions and forbidden transitions. | High |
| Acceptance criteria | `docs/business/ACCEPTANCE_CRITERIA.md` | Done/pass/partial/missing criteria. | High |
| Architecture | `docs/ARCHITECTURE.md` | Component boundaries and architecture context. | Medium-High |
| Data contract | `docs/DATA_CONTRACT.md` | Canonical data ownership and drift. | High |
| API contract | `docs/API_CONTRACT.md` | Endpoint inventory and API behavior expectations. | High |
| Permission matrix | `docs/PERMISSION_MATRIX.md` | Not found at requested path. | N/A |
| API flow map | `docs/API_FLOW_MAP.md` | Workflow to API/service/data/security chain. | High |
| Integration guide | `docs/INTEGRATION_GUIDE.md` | Not found at requested path. | N/A |
| Testing guide | `docs/TESTING_GUIDE.md` | Scripts, CI gates, historical evidence and missing coverage. | High |
| Deployment guide | `docs/DEPLOYMENT_GUIDE.md` | Not found at requested path. | N/A |
| Public web | `bigbike-web/lib/utils/routes.ts`, `bigbike-web/lib/api/public-api.ts`, `bigbike-web/lib/api/client-api.ts` | Public/customer routes and API clients. | High |
| Admin | `bigbike-admin/src/App.jsx`, `bigbike-admin/src/lib/adminApi.js` | Admin routes, permissions and API client. | High |
| Mobile | `bigbike_mobile/lib/core/router/app_router.dart`, `bigbike_mobile/lib/core/api/api_endpoints.dart` | Mobile routes/endpoints. | High |
| Security | `SecurityConfig.java` | Public/customer/admin boundary and filters. | High |
| Cart/checkout | `CartController.java`, `CheckoutController.java`, `CheckoutService.java` | Cart/checkout/order creation flow. | High |
| Orders | `AdminOrderController.java`, `AdminOrderService.java`, `CustomerOrderController.java` | Admin/customer order/payment/refund/return flow. | High |
| CI | `.github/workflows/ci.yml` | Backend/web/admin CI gates. | High |
| Runtime | `docker-compose.yaml` | Services, healthchecks and runtime config boundaries. | High |
| Backend tests | `bigbike-backend/target/maven-status/maven-compiler-plugin/testCompile/default-testCompile/inputFiles.lst` | Backend test files existed at prior compile time. | Medium-High |
| Historical reports | `bigbike-backend/target/surefire-reports/*.txt/xml` | Old results only, not current pass. | Medium |

## 18. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Project/system/business context. |
| `BUSINESS_PROCESS.md` | Source for business process list. |
| `MODULE_CATALOG.md` | Source for module-feature map. |
| `USER_ROLES.md` | Source for actors/roles/RBAC context. |
| `WORKFLOW_OVERVIEW.md` | Source for workflow intent. |
| `BUSINESS_RULES.md` | Source for rule IDs/enforcement/test gaps. |
| `STATE_MACHINES.md` | Source for transition mapping. |
| `ACCEPTANCE_CRITERIA.md` | Source for done/pass/partial criteria. |
| `ARCHITECTURE.md` | Architecture/component boundary context. |
| `DATA_CONTRACT.md` | Data ownership and API data mapping. |
| `API_CONTRACT.md` | Endpoint and response/error/auth expectations. |
| `PERMISSION_MATRIX.md` | Not found; matrix uses source evidence until created. |
| `API_FLOW_MAP.md` | Workflow → API → service → data mapping. |
| `INTEGRATION_GUIDE.md` | Not found; integration mapping derived from source/docs. |
| `TESTING_GUIDE.md` | Scripts, CI, historical reports and missing tests. |
| `DEPLOYMENT_GUIDE.md` | Not found; deployment mapping derived from CI/compose. |

## Audit Notes

- Chỉ đọc/inspect repo/docs/source evidence.
- Không chạy build/test/deploy.
- Không sửa code.
- Không refactor.
- Không implement feature mới.
- Không đưa giá trị cấu hình nhạy cảm vào file.
- `PERMISSION_MATRIX.md`, `INTEGRATION_GUIDE.md`, `DEPLOYMENT_GUIDE.md` chưa thấy ở path yêu cầu tại thời điểm audit.
- Historical reports trong `target/` chỉ là `HISTORICAL_EVIDENCE`, không phải bằng chứng pass hiện tại.
