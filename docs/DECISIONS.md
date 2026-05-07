# BigBike Decisions

## D-001

- ID: `D-001`
- Date: `2026-05-07`
- Status: `ACCEPTED`
- Context: The repo contains both human-readable API docs and a checked-in OpenAPI file, but they drifted from live controllers.
- Decision: `docs/engineering/API_CONTRACT.md` is the human-readable contract companion, and `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` is the machine-readable companion. Both must be updated when controller coverage changes.
- Consequences:
  - OpenAPI cannot be treated as authoritative if it omits live controllers.
  - Controller/service/config/test evidence is the verification source during drift.
  - Historical reports cannot override the updated canonical contract.

## D-002

- ID: `D-002`
- Date: `2026-05-07`
- Status: `ACCEPTED`
- Context: POS documentation described pending-payment and expiry behavior that is not present in current code.
- Decision: The current POS flow is an immediate in-store sale implemented by `AdminPosController` and `PosOrderService`, creating orders with `status=COMPLETED` and `paymentStatus=PAID`.
- Consequences:
  - POS is documented separately from customer checkout.
  - POS orders must capture staff/customer/payment/audit context from the current implementation.
  - No POS expiry cleanup lifecycle should be documented unless new code is added.

## D-003

- ID: `D-003`
- Date: `2026-05-07`
- Status: `ACCEPTED`
- Context: Media hardening changed server-side validation behavior, but docs still described MIME trust and SVG acceptance.
- Decision: Admin media upload validation is server-side content validation using Apache Tika magic-byte detection. SVG is not in the allowlist and is treated as rejected input.
- Consequences:
  - Media docs must describe Tika-based MIME detection, file-size cap, and SVG rejection.
  - Security and testing docs must cite the hardened backend tests.

## D-004

- ID: `D-004`
- Date: `2026-05-07`
- Status: `ACCEPTED`
- Context: Coupon docs lagged behind implementation. Current code applies coupons in cart, revalidates at checkout, and expires overdue coupons on a scheduler.
- Decision: Coupons are a live module. The canonical lifecycle is cart apply -> cart refresh/revalidation -> checkout redemption snapshot -> scheduled expiry.
- Consequences:
  - Coupon docs must cover one-coupon-per-cart enforcement, checkout redemption, and scheduler behavior.
  - Tests for cart and checkout coupon flows are part of the canonical evidence set.

## D-005

- ID: `D-005`
- Date: `2026-05-07`
- Status: `ACCEPTED`
- Context: Flyway migrations created stock receipt tables, but the current Java service/controller layer is movement-based and no active stock-receipt API/service was confirmed.
- Decision: `stock_receipts`, `stock_receipt_lines`, and `stock_receipt_serials` are documented as schema-present but implementation-pending/orphaned until a live Java API/service exists.
- Consequences:
  - Canonical docs must not invent an active receiving workflow on top of these tables.
  - Inventory docs must separate confirmed movement-based serial handling from receipt-schema presence.

## D-006

- ID: `D-006`
- Date: `2026-05-07`
- Status: `ACCEPTED`
- Context: Admin order notifications use WebSocket/STOMP, but the contract was underdocumented.
- Decision: The current documented WebSocket contract is `/ws` for STOMP CONNECT, admin JWT in the native `Authorization` header, and `/topic/admin/orders` for order events.
- Consequences:
  - Canonical docs must name the required connect auth, current topic, and the `OrderWsEvent` payload.
  - Additional topics or inbound commands remain `NEEDS_VERIFICATION` until code exists.

## D-007

- ID: `D-007`
- Date: `2026-05-07`
- Status: `ACCEPTED`
- Context: `bigbike_mobile/README.md` was still the Flutter starter template, even though the app already ships with a real API client, router, and endpoint map.
- Decision: Mobile docs must describe the real Flutter companion app, its Dio cookie/CSRF client behavior, and current endpoint coverage status.
- Consequences:
  - Mobile docs must call out missing wrappers when endpoints exist in backend but are not represented in `api_endpoints.dart`.
  - Mobile status remains production-scope `NEEDS_VERIFICATION` until release ownership is formally documented.
