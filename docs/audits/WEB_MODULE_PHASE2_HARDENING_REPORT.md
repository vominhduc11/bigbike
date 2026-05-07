# WEB MODULE — PHASE 2 HARDENING REPORT

**Date:** 2026-05-07  
**Engineer:** Claude (Senior Full-stack)  
**Scope:** `bigbike-web/` only — no admin/mobile/backend changes  
**Commit:** `a4625c5` (merged into `main`)

---

## Summary

Phase 2 hardening addressed security gaps, API mismatches, and redundant network calls discovered during the Phase 1 post-audit review. No business logic was changed. Checkout, order, stock, coupon, and payment flows were not touched.

---

## Files Changed

### Modified

| File | What changed |
|------|-------------|
| `app/api/search-suggest/route.ts` | Was calling wrong backend endpoint; fixed to call `/api/v1/search-suggest` with correct params |
| `components/layout/SearchToggle.tsx` | Removed dead warm-up fetch to product list; now calls only the search-suggest proxy |
| `app/robots.ts` | Added `/xac-nhan-email` and `/xac-nhan-email/` to disallow list |
| `app/dang-nhap/page.tsx` | Replaced inline open-redirect guard with `isSafeReturnTo()` |
| `lib/cart-context.tsx` | Added in-flight guard (`fetchInFlight` ref) to prevent duplicate concurrent `fetchCart` calls |

### Created

| File | Purpose |
|------|---------|
| `lib/utils/auth.ts` | `isSafeReturnTo(url)` — same-origin path guard for login redirect |
| `__tests__/api/snapshot-route.test.ts` | 4 tests covering the `/api/products/[id]/snapshot` proxy route |
| `__tests__/api/search-suggest-route.test.ts` | 5 tests covering the corrected search-suggest route |
| `__tests__/contracts/price-changes.test.ts` | 3 type-level tests asserting `PriceChange` and `OrderSummary.priceChanges` shape |
| `__tests__/seo/robots.test.ts` | 5 tests asserting disallow rules and sitemap in `robots()` |
| `__tests__/utils/auth.test.ts` | 9 tests covering `isSafeReturnTo` including edge cases |

### Deleted

| File | Reason |
|------|--------|
| `app/api/cart/add/route.ts` | Dead route — no caller in the codebase; cart mutations go through backend directly |
| `app/api/orders/quick-buy/route.ts` | Dead route — no caller in the codebase |

---

## Issues Fixed

### 1. Wrong backend endpoint for search suggestions (`CRITICAL`)

**Before:** `SearchToggle` fetched two URLs — a dead WordPress-style products URL first, then `/api/search-suggest` as a fallback. The proxy route itself called `/api/v1/products` with `size=6&page=1` — a pagination endpoint that does not exist for search.

**After:** `SearchToggle` fetches only `/api/search-suggest`. The proxy calls `/api/v1/search-suggest` with `limit=6`, and correctly unwraps `data.products` from the backend response shape `{ data: { query, products, articles } }`.

**Evidence:** Backend `SearchPayload` DTO defines `{ query: string, products: List<ProductSummary>, articles: List<ArticleSummary> }`.

### 2. Open-redirect in login page (`HIGH`)

**Before:** Inline guard `raw.startsWith("/") && !raw.startsWith("//")` was correct logic but not tested, not reusable, and was added ad-hoc without coverage.

**After:** Extracted to `isSafeReturnTo(url)` in `lib/utils/auth.ts`. Login page uses the function. 9 unit tests cover: simple paths, deep paths, root `/`, absolute HTTPS URLs, protocol-relative `//evil.com`, `javascript:` scheme, empty string, and relative paths without leading slash.

### 3. Missing `robots.ts` disallow entries (`MEDIUM`)

**Before:** `/xac-nhan-email` (email verification page) was not in the disallow list — search engines could index it.

**After:** Both `/xac-nhan-email` and `/xac-nhan-email/` added to disallow. Tests assert both variants.

### 4. Concurrent `fetchCart` calls (`MEDIUM`)

**Before:** Rapid re-renders or back-to-back `addToCart` events could fire multiple `fetchCart` calls simultaneously, each setting `cartCount`, causing UI flicker and redundant backend requests.

**After:** `fetchInFlight` ref guards entry — a second call while one is in-flight returns immediately. The ref resets in `.finally()`.

### 5. Dead API routes (`LOW`)

**Before:** `app/api/cart/add/route.ts` and `app/api/orders/quick-buy/route.ts` existed with no callers. They used an old `adminApi` import pattern and would have returned errors if accidentally hit.

**After:** Both files deleted. `next build` confirms neither route appears in the build output.

---

## Tests Added

| Test file | Count | Coverage |
|-----------|-------|---------|
| `__tests__/utils/auth.test.ts` | 9 | `isSafeReturnTo` — all safe/unsafe path permutations |
| `__tests__/api/search-suggest-route.test.ts` | 5 | Correct endpoint, `limit` param, products unwrap, short-query guard, network error |
| `__tests__/api/snapshot-route.test.ts` | 4 | Correct URL, data passthrough, 404 forwarding, 502 on unreachable backend |
| `__tests__/seo/robots.test.ts` | 5 | `/xac-nhan-email` variants, auth routes, `/api/`, sitemap URL |
| `__tests__/contracts/price-changes.test.ts` | 3 | `PriceChange` shape, `OrderSummary.priceChanges` optional type, base fields |

---

## Checks

| Check | Result | Details |
|-------|--------|---------|
| `npm run lint` | **PASS** | 0 errors. 1 pre-existing warning in `app/thanh-toan/page.tsx` (React Compiler / `react-hook-form` `watch()` incompatibility — not introduced by this PR) |
| `npm run test` | **PASS** | 12 test files / 95 tests |
| `npm run build` | **PASS** | 31 routes, no type errors, deleted routes absent from output |

---

## Remaining Risks / Phase 3 Smoke-Test Checklist

The following are not regressions introduced here, but should be verified manually or in a staging environment before the next release:

### Functional smoke tests

- [ ] **Search bar** — type ≥ 2 characters, confirm suggestions appear (now from `/api/v1/search-suggest`)
- [ ] **Search bar** — type 1 character, confirm no network request is made and suggestions clear
- [ ] **Login redirect** — `?tiep=/tai-khoan/don-hang/abc-123` redirects correctly after login
- [ ] **Login redirect** — `?tiep=https://evil.com` falls back to `/tai-khoan` (no external redirect)
- [ ] **Login redirect** — `?tiep=//evil.com` falls back to `/tai-khoan`
- [ ] **Cart** — rapid add-to-cart taps do not cause duplicate cart count (verify `fetchInFlight` guard)
- [ ] **Email verification** — `/xac-nhan-email` page loads correctly (not broken by robots.ts)

### SEO / crawler

- [ ] `GET /robots.txt` — confirm `/xac-nhan-email` appears in Disallow
- [ ] `GET /sitemap.xml` — sitemap still resolves correctly

### Known pre-existing issues (not in scope for Phase 2)

- `app/thanh-toan/page.tsx:129` — React Compiler warning for `watch()` from `react-hook-form`. This is a known incompatibility tracked separately; do not fix in this scope.
- `app/api/products/[id]/snapshot/route.ts` — snapshot route was added in Phase 1; verify against backend `GET /api/v1/products/{id}/snapshot` endpoint availability in staging.
