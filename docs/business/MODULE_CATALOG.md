# Module Catalog

## Public Platform Modules

| Module | Surface | Current implementation | Status | Evidence |
|---|---|---|---|---|
| Catalog browse | web, backend, mobile | Products, categories, brands, articles, pages, settings, menus, sliders, home videos | `CONFIRMED_FROM_CODE` | public controllers, `public-api.ts`, `api_endpoints.dart` |
| Page hero banners | web, backend, admin | Admin-managed hero (image + title + description + kicker) on every public content page. Backed by `PageEntity` for CMS pages and by `public_hero` settings group for listing pages (`/san-pham`, `/brands`, `/tin-tuc`). | `CONFIRMED_FROM_CODE` | `PageEntity.java` hero fields (V98), `SettingDefinitionRegistry` `hero_*` keys, `bigbike-web/components/layout/PageHero.tsx` |
| Search | web, backend, mobile | `GET /api/v1/search` and `GET /api/v1/search-suggest` | `CONFIRMED_FROM_CODE` | `PublicSearchController.java`, `SecurityConfig.java`, clients |
| Contact | web, backend, mobile | `POST /api/v1/contact` — public form persists into `contact_messages` (V105) and emails admin (best-effort). | `CONFIRMED_FROM_CODE` | `ContactController.java`, `ContactService.java`, `client-api.ts`, `api_endpoints.dart` |
| Cart | web, backend, mobile | Guest/customer cart with CSRF-protected mutations | `CONFIRMED_FROM_CODE` | `CartController.java`, `CartService.java`, tests |
| Checkout | web, backend, mobile | Cart checkout and quick buy with shipping/payment validation and idempotency | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, tests, clients |
| Customer account | web, backend, mobile | Profile, addresses, orders, returns | `CONFIRMED_FROM_CODE` | customer controllers, clients |
| Vietnam address lookup | web, backend, mobile | Province -> district -> ward lookup | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, web/mobile helpers |

## Admin Platform Modules

| Module | Surface | Current implementation | Status | Evidence |
|---|---|---|---|---|
| Catalog admin | admin, backend | Product/category/brand CRUD and related reads | `CONFIRMED_FROM_CODE` | `AdminCatalogController.java`, admin routes |
| Order admin | admin, backend | Order list/detail/status/payment/note workflows | `CONFIRMED_FROM_CODE` | `AdminOrderController.java`, admin app |
| Customer admin | admin, backend | Customer list/detail/update | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java` |
| Media admin | admin, backend | Upload/list/detail/update/delete/restore media | `CONFIRMED_FROM_CODE` | `AdminMediaController.java`, `AdminMediaService.java` |
| Settings admin | admin, backend | Site settings read/update | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, tests |
| Menu admin | admin, backend | Menu-item CRUD and reorder inside the three system slots (`primary`, `footer`, `guide`). Menu containers themselves are system-defined — admins cannot create new locations or delete the system slots. See `MENUS_SYSTEM_SLOT_FIX_REPORT.md`. | `CONFIRMED_FROM_CODE` | `AdminMenuController.java`, `MenuLocations.java`, `V84__seed_system_menu_slots.sql`, tests |
| Coupon admin | admin, backend | Coupon CRUD and lifecycle management | `CONFIRMED_FROM_CODE` | `AdminCouponController.java`, tests |
| Inventory admin | admin, backend | Inventory list, summary, movement list, manual adjustment, CSV export | `CONFIRMED_FROM_CODE` | `AdminInventoryController.java`, `AdminInventoryService.java` |
| Returns admin | admin, backend | Return list/detail/status update | `CONFIRMED_FROM_CODE` | `AdminReturnController.java`, `Phase1LReturnsApiTest.java` |
| Redirect admin | admin, backend | Redirect CRUD and internal redirect support | `CONFIRMED_FROM_CODE` | `AdminRedirectController.java`, `SecurityConfig.java` |
| POS | admin, backend | Product search, immediate POS sale (CASH/CARD_TERMINAL), and credit sale (CREDIT) with customer receivable creation | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java` |
| Admin order WebSocket | admin, backend | Subscribe to `/topic/admin/orders` for order events | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java`, `adminWebSocket.js` |
| Accounts Receivable admin | admin, backend | Receivable list/detail, payment recording, write-off, aging report, customer credit profile management | `CONFIRMED_FROM_CODE` | `AdminReceivableController.java`, `ReceivableService.java`, `ReceivableQueryService.java`, `CreditPolicyService.java`, `V75__add_credit_and_receivables.sql` |
| Audit logs admin | admin, backend | Read-only paginated activity log with filters (actorType, resourceType, action, date range). Enriches actor name and resource label. Permission: `audit-logs.read`. | `CONFIRMED_FROM_CODE` | `AdminAuditLogController.java`, `AdminAuditLogService.java` |
| Contact inbox admin | admin, backend | List/detail/update of customer contact-form submissions. Status workflow `OPEN → IN_PROGRESS → RESOLVED/CLOSED`, with admin note and assignee. Permissions: `contact.read`, `contact.write`. (V105) | `CONFIRMED_FROM_CODE` | `AdminContactController.java`, `AdminContactService.java`, `V105__create_contact_messages.sql` |

## Inventory And Receiving Subdomains

| Subdomain | Current implementation | Status | Evidence |
|---|---|---|---|
| Stock movement timeline | Movement-based stock audit with `IN`, `OUT`, `ADJUSTMENT`, `RETURN` | `CONFIRMED_FROM_CODE` | `AdminInventoryService.java` |
| Stock movement serials | Serials stored on `stock_movement_serials`; stock-in requires serial count to match quantity | `CONFIRMED_FROM_CODE` | `AdminInventoryService.java`, `V57__add_stock_movement_serials.sql` |
| Stock receipt schema | Receipt tables exist in DB schema only | `NOT_FOUND_IN_REPO` in active service/controller layer | `V52`, `V53`, `V55` migrations, source search |

## Mobile Coverage Notes

| Topic | Current status | Evidence |
|---|---|---|
| Public catalog/search/contact/address/cart/checkout/account endpoints wrapped in mobile client | `CONFIRMED_FROM_CODE` | `bigbike_mobile/lib/core/api/api_endpoints.dart` |
| Verify-email wrapper missing | `CODE_ONLY_NOT_DOCUMENTED` | `CustomerAuthController.java`, `api_endpoints.dart` |
| Home-videos wrapper missing | `CODE_ONLY_NOT_DOCUMENTED` | `SecurityConfig.java`, `bigbike-openapi.json`, `api_endpoints.dart` |
