# BigBike Mobile

Flutter companion app for the BigBike platform.

## Current Status

- Scope: `NEEDS_VERIFICATION` for production ownership.
- Runtime: Flutter / Dart `sdk: ^3.11.4`
- State: `flutter_riverpod`, `hooks_riverpod`, `flutter_hooks`
- Navigation: `go_router`
- Networking: `dio`, `dio_cookie_manager`, `cookie_jar`
- Storage: `flutter_secure_storage`, `shared_preferences`

## Verified Architecture

| Area | Current implementation | Status | Evidence |
|---|---|---|---|
| API client | Central Dio client with cookie persistence and CSRF header injection for mutations. | `CONFIRMED_FROM_CODE` | `lib/core/api/api_client.dart` |
| Endpoint registry | Central string constants for public, customer, cart, checkout, contact, and VN address APIs. | `CONFIRMED_FROM_CODE` | `lib/core/api/api_endpoints.dart` |
| Error handling | Shared API exception model. | `CONFIRMED_FROM_CODE` | `lib/core/api/api_exception.dart` |
| Routing | App router defined with `go_router`. | `CONFIRMED_FROM_CODE` | `lib/core/router/app_router.dart` |

## Verified API Coverage

Implemented endpoint constants include:

- Public catalog/content reads
- Search and search suggest
- Cart and checkout
- Customer auth login/register/logout/forgot/reset
- Customer profile, addresses, orders, returns
- Contact form
- Vietnamese address lookup

## Known Gaps

| Gap | Status | Evidence |
|---|---|---|
| `GET /api/v1/home-videos` is public in backend but not represented in `api_endpoints.dart`. | `CODE_ONLY_NOT_DOCUMENTED` | `SecurityConfig.java`, `bigbike-openapi.json`, `lib/core/api/api_endpoints.dart` |
| Customer wishlist is live in backend (`CustomerWishlistController`) but has no mobile UI/API wrapper. | `CODE_ONLY_NOT_DOCUMENTED` | `CustomerWishlistController.java`, `lib/core/api/api_endpoints.dart` |
| Production release ownership and supported feature matrix are not formally documented. | `NEEDS_VERIFICATION` | repo docs review |

## Client Behavior Notes

- Customer and guest flows rely on cookie-based sessions, not bearer tokens.
- Mutating requests add `X-CSRF-Token` from the `bb_csrf` cookie.
- This client is aligned with backend cookie/CSRF behavior used by cart, checkout, customer address, and logout flows.

## Local Commands

```bash
flutter pub get
flutter test
flutter run
```

CI status:

- No mobile job is configured in `.github/workflows/ci.yml`.

## Canonical References

- `docs/business/PROJECT_OVERVIEW.md`
- `docs/business/WORKFLOW_OVERVIEW.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/engineering/API_FLOW_MAP.md`
