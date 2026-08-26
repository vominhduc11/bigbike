# Traceability Matrix

| Business capability | Client surface | API/controller | Service/data path | Test evidence | Status |
|---|---|---|---|---|---|
| Catalog search | web | `PublicSearchController` | search service + payload DTOs | indirect via clients; no dedicated suite confirmed here | `CONFIRMED_FROM_CODE` |
| Vietnam address lookup | web dùng dữ liệu tích hợp sẵn; API công khai không có caller nội bộ | `VnAddressController` | `VnAddressService`/`vn-address.json`; web `vn-address-data.ts` | no dedicated backend endpoint test confirmed | `CONFIRMED_FROM_CODE` |
| Cart | web | `CartController` | `CartService`, cart tables | `Phase1ECartApiTest.java` | `CONFIRMED_FROM_TEST` |
| Checkout | web | `CheckoutController` | `CheckoutService`, order/payment/shipping tables (per-variant `isAvailable` gate; no quantity decrement, V261) | `Phase1FCheckoutApiTest.java` | `CONFIRMED_FROM_TEST` |
| ~~POS~~ | — | — | Removed platform-wide (owner decision 2026-06-23, online-only) — controller, service, and `Phase1MPosApiTest` deleted. | — | `REMOVED` |
| Media hardening | admin | `AdminMediaController` | `AdminMediaService`, MinIO/media refs | `AdminMediaP0Test.java` | `CONFIRMED_FROM_TEST` |
| Role permission dependencies | admin | `AdminRolesController`, `AdminPermissionsController` | `PermissionCatalog`, `AdminRoleService`, `role_permissions`, V366 | `AdminRoleServiceTest`, `AdminRolesApiTest`, `PermissionDependencyMigrationTest` | `OWNER_CONFIRMED_2026-07-31` |
| Admin navigation/route policy | admin | module controllers | central `adminAccessPolicy` + screen action gates | `adminAccessPolicy.test.js`, `App.test.jsx`, targeted screen tests | `OWNER_CONFIRMED_2026-07-31` |
| Customer addresses | web | `CustomerAddressController` | `CustomerAddressService` | no dedicated suite reopened in this pass | `CONFIRMED_FROM_CODE` |
| Admin order push | admin | WebSocket `/ws` + `/topic/admin/orders` | `WebSocketConfig`, `AdminOrderWsService`, `OrderWsEvent` | no dedicated automated WS suite reopened in this pass | `CONFIRMED_FROM_CODE` |
| Receipt-based receiving flow | none | none | dropped in V120 | none | `REMOVED` |
| Dashboard revenue and supporting inventory access | admin | `AdminDashboardController`, `AdminInventoryController` | `orders.read` route; optional `inventory.read` widget/topic | `DashboardScreen.test.jsx`, `AdminReadApiTest.java` | `OWNER_CONFIRMED_2026-07-31` |
| External payment provider / webhook | none confirmed | none confirmed | none confirmed (new storefront orders use provider `INTERNAL` with manual `COD`/`BANK_TRANSFER`; BACS is legacy-order compatibility only) | none | `NOT_FOUND_IN_REPO` |
| External shipping carrier | none confirmed | none confirmed | none confirmed (manual tracking metadata only; no carrier integration / waybill) | none | `NOT_FOUND_IN_REPO` |
| Invoice / e-invoice | none | none | none | none | `OUT_OF_SCOPE` (owner 2026-07-06 — không triển khai) |
| Stock receiving workflow | none | none | receipt tables dropped in V120 (`V120__drop_stock_receipt_tables.sql`); inventory is now a boolean availability toggle (no receiving flow, V261) | none | `REMOVED` |
| Trợ lý BigBike — model động, fallback, chi phí và bộ đề | web progress; admin Settings/evaluation/cost | public chat + admin model/evaluation/stats controllers | Gemini model discovery, model registry, usage ledger, versioned evaluation runs | Phase 4 A VI/EN + full Phase 1–3 regression | `IMPLEMENTED; LIVE_PAID_BENCHMARK_AND_141_REAL_QUESTION_GROUND_TRUTH_PENDING_OWNER` |
| Trợ lý BigBike — ảnh khách riêng tư | web widget/history; admin conversation detail | public chat image upload/content + admin image content | private MinIO, `chat_images`, image quota/intent/matching/retention | Phase 4 B VI/EN + ownership/delete/90-day tests | `IMPLEMENTED_WITH_FIXTURES; REAL_CATALOG_PHOTO_CALIBRATION_PENDING_OWNER` |
