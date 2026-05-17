# Library Standardization Roadmap

**Date:** 2026-05-17  
**Nguồn:** [LIBRARY_USAGE_PROFESSIONALIZATION_AUDIT.md](../audits/LIBRARY_USAGE_PROFESSIONALIZATION_AUDIT.md)  
**Scope:** `bigbike-web/` — migration legacy CSS + component tests + Playwright

---

## Tổng quan

Codebase đã đạt trạng thái tốt về library usage sau Phase 1-2 audit. Roadmap này tập trung vào:

1. **CSS legacy migration** — 1,583 class `.bb-*` / `.wp-*` trong `globals.css` → Tailwind inline hoặc shared component
2. **Component test coverage** — mở rộng từ 1 component test hiện tại
3. **Playwright e2e** — thiết lập config + smoke tests
4. **proxy.ts env migration** — sau khi xác nhận Edge runtime compatibility với t3-oss

---

## Batch 0 — Đã hoàn thành (Phase 2 audit)

**Status:** ✅ Done (2026-05-17)

| Fix | File |
|-----|------|
| env.ts thêm NEXT_PUBLIC_SITE_URL, BIGBIKE_SITE_URL, INTERNAL_API_TOKEN, BIGBIKE_REDIRECT_CACHE_TTL_SECONDS | `env.ts` |
| lib/api/public-api.ts dùng env | `lib/api/public-api.ts` |
| lib/api/client-api.ts dùng env | `lib/api/client-api.ts` |
| app/layout.tsx dùng env | `app/layout.tsx` |
| app/bao-hanh/WarrantyContent.tsx dùng env | `app/bao-hanh/WarrantyContent.tsx` |
| app/xac-nhan-email/page.tsx dùng env | `app/xac-nhan-email/page.tsx` |
| 6 API route handlers dùng env | `app/api/products/[id]/{variants,stock,snapshot,reviews,pricing}/route.ts` |
| revalidate route dùng env | `app/api/revalidate/route.ts` |
| Remove tippy.js + @tippyjs/react | `package.json` |

---

## Batch 1 — Playwright E2E Setup

**Priority:** P1  
**Risk:** Thấp — chỉ thêm test, không sửa source code  
**Estimated effort:** 1 ngày

### Files cần tạo

```
bigbike-web/
  playwright.config.ts          # Config mới
  e2e/
    smoke.spec.ts               # Smoke tests các trang chính
    product.spec.ts             # PDP critical path
    auth.spec.ts                # Login/logout
    cart.spec.ts                # Add to cart
```

### playwright.config.ts (template)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.QA_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
});
```

### Smoke tests cần có

| Test | URL | Assert |
|------|-----|--------|
| Trang chủ | `/` | Có hero slider, section sản phẩm |
| Danh sách sản phẩm | `/san-pham/` | Có product cards, không có lỗi |
| Product detail | `/product/{slug}/` | Có tên SP, giá, nút thêm giỏ |
| Login page | `/dang-nhap/` | Có form, email + password fields |
| Cart page | `/gio-hang/` | Load được (empty state OK) |
| Tin tức | `/tin-tuc/` | Có article list |

### Validation command

```bash
npx playwright test --reporter=html
```

### Rollback

Chỉ tạo file mới — xóa `playwright.config.ts` và `e2e/` nếu cần rollback.

---

## Batch 2 — proxy.ts env Migration

**Priority:** P2  
**Risk:** Trung bình — Edge runtime, cần kiểm tra t3-oss compatibility  
**Estimated effort:** 2-4 giờ

### Kiểm tra trước khi fix

```bash
# Xác nhận @t3-oss/env-nextjs hoạt động trong Edge runtime
# Đọc: https://env.t3.gg/docs/nextjs
```

### Files affected

- `proxy.ts` — thay `process.env.BIGBIKE_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `INTERNAL_API_TOKEN`, `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS`
- `lib/utils/routes.ts` — thay `NEXT_PUBLIC_SITE_URL` (đã có trong env.ts client section)

### Expected result

```typescript
// proxy.ts - sau fix
import { env } from "@/env";

const API_BASE_URL = env.BIGBIKE_API_BASE_URL ?? env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const TTL_SECONDS = Number.parseInt(env.BIGBIKE_REDIRECT_CACHE_TTL_SECONDS ?? "30", 10);
const INTERNAL_TOKEN = env.INTERNAL_API_TOKEN ?? "";
```

### Validation command

```bash
npm run build
# Kiểm tra proxy.ts compile không lỗi
# Test redirect với curl: curl -v http://localhost:3000/old-path/
```

### Rollback

Revert `proxy.ts` về `process.env` nếu Edge runtime báo lỗi.

---

## Batch 3 — Shared UI Primitives — Component Tests

**Priority:** P2  
**Risk:** Thấp — chỉ thêm tests  
**Estimated effort:** 2 ngày

### Components cần có tests

| Component | Test file | Scenarios |
|-----------|-----------|-----------|
| `components/ui/button.tsx` | `__tests__/components/ui/button.test.tsx` | Variants, disabled, loading, click handler |
| `components/ui/input.tsx` | `__tests__/components/ui/input.test.tsx` | Value, onChange, error state, aria |
| `lib/utils.ts` (`cn()`) | `__tests__/utils/cn.test.ts` | Merge classes, conditional, override |
| `components/catalog/ReviewsSection.tsx` | Đã có — cập nhật khi cần | Pagination, empty state |
| `components/ui/StatusBadge.tsx` | `__tests__/components/ui/status-badge.test.tsx` | Tone variants, label rendering |

### Test pattern chuẩn

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

test("disabled button không trigger onClick", async () => {
  const onClick = vi.fn();
  render(<Button disabled onClick={onClick}>Click</Button>);
  await userEvent.click(screen.getByRole("button"));
  expect(onClick).not.toHaveBeenCalled();
});
```

### Validation command

```bash
npm run test
npm run test:coverage
```

---

## Batch 4 — Auth Forms — Visual Consistency Check

**Priority:** P2  
**Risk:** Thấp — không thay đổi business logic  
**Estimated effort:** 4 giờ

### Files affected

```
app/dang-nhap/LoginForm.tsx
app/dang-ky/RegisterForm.tsx
app/quen-mat-khau/ForgotPasswordFlow.tsx
```

### Checklist

- [ ] Form có `aria-invalid` trên field bị lỗi
- [ ] Form có `aria-describedby` trỏ tới error message
- [ ] Loading state disable nút submit
- [ ] Error message hiển thị dưới field, không phải alert
- [ ] Không còn class CSS legacy `.bb-auth-*` nếu đã có Tailwind equivalent

### Validation

```bash
npm run lint
npx tsc --noEmit
# Manual test: thử submit form với dữ liệu sai và đúng
```

---

## Batch 5 — Catalog Filters

**Priority:** P2  
**Risk:** Trung bình — filters ảnh hưởng SEO/URL params  
**Estimated effort:** 4-6 giờ

### Files affected

```
components/catalog/CatalogFilters.tsx
app/san-pham/page.tsx
app/danh-muc-san-pham/[slug]/page.tsx
```

### Checklist

- [ ] Filter UI dùng Radix Checkbox/RadioGroup thay vì native `<input type="checkbox">`
- [ ] Filter count badge dùng `Badge` component từ shadcn
- [ ] Clear filters button dùng `Button` component
- [ ] Filter panel dùng `Sheet` khi mobile (nếu đang dùng raw div)
- [ ] Không còn `.bb-query-*` classes nếu Tailwind đủ

### Risk note

URL param thay đổi ảnh hưởng SEO — KHÔNG đổi param name, chỉ đổi visual component.

### Validation

```bash
npm run build
# Test: filter sản phẩm, URL params giữ nguyên
```

---

## Batch 6 — Product Card Variants

**Priority:** P3  
**Risk:** Trung bình — ảnh hưởng visual layout toàn bộ trang listing  
**Estimated effort:** 1 ngày

### Files affected

```
components/catalog/ProductCard.tsx
components/home/FeaturedProductsCarousel.tsx
app/san-pham/page.tsx
app/danh-muc-san-pham/[slug]/page.tsx
```

### Checklist

- [ ] ProductCard có variants qua CVA (nếu cần: default, featured, compact)
- [ ] Badge giá giảm dùng `Badge` component
- [ ] Stock status dùng `StatusBadge` component
- [ ] Rating dùng `RatingStars` component
- [ ] Không còn `.bb-card-*` classes nếu Tailwind đủ

### Validation

```bash
npm run build
# Visual: product card nhìn nhất quán trên listing và carousel
```

---

## Batch 7 — Cart / Checkout

**Priority:** P1  
**Risk:** Cao — ảnh hưởng conversion flow  
**Estimated effort:** 1 ngày

### Files affected

```
app/gio-hang/          # Cart page
app/thanh-toan/        # Checkout page
components/cart/
```

### Checklist

- [ ] Cart quantity input dùng `QuantityStepper` component (đã có trong `components/ui/`)
- [ ] Checkout form fields dùng `Form`, `FormField`, `Input` từ shadcn
- [ ] Address fields dùng `VnAddressFields` component (đã có)
- [ ] Loading states dùng `Skeleton` components
- [ ] Error states dùng `ErrorState` component

### Risk note

KHÔNG thay đổi form validation logic, Zod schema, API payload — chỉ đổi visual.

### Validation

```bash
npm run test # schema tests phải pass
npm run build
# E2e: add to cart, checkout flow (nếu Playwright đã setup)
```

---

## Batch 8 — Account Pages

**Priority:** P2  
**Risk:** Thấp-trung bình — authenticated only  
**Estimated effort:** 4-6 giờ

### Files affected

```
app/tai-khoan/
app/tai-khoan/don-hang/
app/tai-khoan/doi-mat-khau/
```

### Checklist

- [ ] Tabs dùng `Tabs` component từ Radix (nếu đang dùng custom tabs)
- [ ] Order list dùng table/card layout nhất quán
- [ ] Address form dùng `VnAddressFields`
- [ ] Loading dùng `Skeleton`
- [ ] Không còn `console.log` debug

---

## Batch 9 — Home Sections + Blog Pages

**Priority:** P3  
**Risk:** Thấp — visual chỉ, không ảnh hưởng business logic  
**Estimated effort:** 2 ngày

### Files affected

```
app/page.tsx                    # Home
components/home/
app/tin-tuc/
app/tin-tuc/[slug]/
```

### Checklist

- [ ] Hero slider — Swiper setup nhất quán với `.swiper-` classes
- [ ] Article content dùng `sanitizeRichHtml` (đã có)
- [ ] Breadcrumb nhất quán
- [ ] Share buttons dùng social icons chuẩn

---

## Batch 10 — Legacy globals.css Cleanup

**Priority:** P3  
**Risk:** Cao — 1,583 classes, ảnh hưởng toàn bộ visual  
**Estimated effort:** 3-5 ngày

### Quy trình

```
Bước 1: Identify class → component mapping
  - grep -rn "bb-fp-" app/ components/ → map sang component
  
Bước 2: Một class tại một thời điểm
  - Chuyển sang Tailwind inline trong component
  - Xóa class khỏi globals.css
  - Chạy build + visual check
  
Bước 3: Verify không còn usage
  - grep -rn "bb-fp-pagination" app/ components/ → 0 results
```

### Class categories (theo priority)

| Category | Prefix | Count ước tính | Priority |
|----------|--------|----------------|----------|
| Featured products carousel | `.bb-fp-*` | ~15 | P2 — liên kết chặt Swiper |
| Skeleton loaders | `.bb-skel-*` | ~20 | P2 — có `Skeleton` component |
| Auth pages | `.bb-auth-*` | ~10 | P2 — đã có shadcn form |
| Grid layouts | `.bb-grid-*` | ~10 | P3 — Tailwind grid đủ |
| Card components | `.bb-card-*` | ~10 | P3 — sau khi Batch 6 xong |
| Article share | `.bb-article-*` | ~5 | P3 |
| WordPress legacy | `.wp-*` | ~500 | P3 — chỉ dùng trong rich text |

### WordPress `.wp-*` classes

Các class `.wp-block-*`, `.wp-caption`, `.wp-image-*` trong `globals.css` được dùng bởi content từ WordPress API (bài viết, trang tĩnh). Không nên xóa bừa — cần:

1. Kiểm tra xem DOMPurify allowlist có giữ class attributes không
2. Nếu có → giữ các class này trong globals.css
3. Nếu DOMPurify strip class attrs → class này vô dụng và có thể xóa

**Validation cho mỗi class xóa:**

```bash
# 1. Kiểm tra còn dùng không
grep -rn "CLASS_NAME" app/ components/ lib/

# 2. Build
npm run build

# 3. Visual check trang liên quan
```

### Rollback strategy

Mỗi class được xóa trong một commit riêng. Rollback = `git revert <commit>`.

---

## Batch 11 — Shared Component Reuse Gaps

**Priority:** P2  
**Risk:** Thấp-trung bình — visual changes, cần verify từng chỗ  
**Nguồn:** Audit tái sử dụng component 2026-05-17

### Đã xử lý (2026-05-17)

- [x] **`PriceText.tsx` đã xóa** — component dead code, 0 import. Hiển thị giá dùng `formatVnd()` inline (40+ chỗ) đã hoạt động ổn định; `PriceText` còn mang class legacy `bb-price` nên adopt sẽ làm lan rộng CSS cũ.

### Còn lại — migrate opportunistic (khi đụng tới component)

| Gap | File:line | Nên dùng | Risk |
|-----|-----------|----------|------|
| Modal đổi trả tự dựng bằng `<div fixed inset-0>` | `app/tai-khoan/doi-tra/page.tsx:64` | `Sheet` (side="right") — có focus trap, ESC, khóa scroll | Trung bình — đổi animation/DOM, cần test |
| `StarRow()` tự code lại bằng SVG | `components/catalog/ReviewsSection.tsx:41,304,323` | `RatingStars` (display-only usages) | Trung bình — `RatingStars` dùng ký tự ★, khác visual SVG |
| Phân trang tự dựng prev/next | `app/tai-khoan/don-hang/page.tsx:199-220` | `PaginationNav` | Thấp-trung bình — cần kiểm tra URL-based vs state-based |
| Skeleton inline `bb-skel` | `LoginForm.tsx`, `tai-khoan/*` (7+ files) | Compose từ `Skeletons.tsx` | Thấp — churn |
| Empty state hard-code text | `doi-tra/page.tsx:331,354`, `GuidePage.tsx:167` | `EmptyState` | Thấp — đổi visual nhỏ |

### Validation cho mỗi gap

```bash
npx tsc --noEmit
npm run test
npm run build
# Visual check trang liên quan
```

### Lưu ý

KHÔNG migrate đồng loạt. Mỗi gap chỉ sửa khi đã chạm vào component đó vì lý do khác (feature/bug). Modal đổi trả ưu tiên cao hơn chút vì accessibility kém hơn (thiếu focus trap).

---

## Metrics để theo dõi

| Metric | Hiện tại (2026-05-17) | Target |
|--------|----------------------|--------|
| `process.env` bypass trong app code | 13 files | 0 (ngoại trừ config files) |
| Unused dependencies | 0 (đã gỡ tippy.js, @tippyjs/react) | 0 |
| Dead-code components | 0 (đã xóa PriceText.tsx) | 0 |
| Component tests | 1 | >= 10 |
| Playwright specs | 0 | >= 5 smoke tests |
| Legacy CSS classes | ~1,583 | < 500 (wp-* được giữ cho rich text) |
| `dangerouslySetInnerHTML` unsanitized | 0 | 0 (maintained) |
| `console.log` in production code | 0 | 0 (maintained) |
