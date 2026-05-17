# Library Usage Professionalization Audit

**Date:** 2026-05-17  
**Scope:** `bigbike-web/` — tất cả dependencies và devDependencies trong `package.json`  
**Auditor:** Claude Sonnet 4.6 (Senior Frontend Architect)

---

## Executive Summary

`bigbike-web` có nền tảng thư viện rất tốt. Hầu hết libraries được dùng đúng vai trò, nhất quán và professional:

- **React Query v5** được setup đầy đủ với `QueryClient`, `queryKeys`, `hooks.ts`, `devtools` — không có direct fetch rải rác trong component.
- **react-hook-form + zod + zodResolver** được dùng thống nhất cho mọi form quan trọng.
- **isomorphic-dompurify** sanitize toàn bộ 24 `dangerouslySetInnerHTML` với allowlist cẩn thận.
- **@radix-ui + shadcn/ui** — 31 shared components, không dùng native HTML elements khi có primitive.
- **pino** logger server-side được setup chuẩn — không còn `console.log` trong production code.
- **@sentry/nextjs** được cấu hình đầy đủ với `instrumentation.ts`, client/server/edge configs.
- **@t3-oss/env-nextjs** — `env.ts` tập trung validate env nhưng **chưa bao phủ hết** các biến đang được dùng.

**Vấn đề chính:** 13 files app code (route handlers + components) dùng `process.env` trực tiếp thay vì import từ `env.ts`. Hai thư viện (`tippy.js`, `@tippyjs/react`) được cài nhưng **không có bất kỳ import nào** trong toàn bộ codebase.

---

## Bảng đánh giá từng thư viện

| # | Thư viện | Version | Status | Risk | Evidence | Recommended Fix |
|---|---------|---------|--------|------|----------|-----------------|
| 1 | `next` | 16.2.4 | **GOOD** | — | App router, server components, Route Handlers, proxy.ts | — |
| 2 | `react` / `react-dom` | 19.2.4 | **GOOD** | — | Toàn bộ component tree | — |
| 3 | `typescript` | ^5 | **GOOD** | — | Strict types, tsc passes | — |
| 4 | `tailwindcss` | ^4 | **GOOD** | — | Primary styling, ~68 `cn()` usages | — |
| 5 | `@tailwindcss/postcss` | ^4 | **GOOD** | — | PostCSS config | — |
| 6 | `class-variance-authority` | ^0.7.1 | **PARTIAL** | P2 | Dùng trong 3 UI components (button, badge, sheet). Các variant component mới có thể chưa dùng CVA | Xem xét áp dụng CVA khi thêm variant component mới |
| 7 | `clsx` + `tailwind-merge` | 2.1.1 + 3.6.0 | **GOOD** | — | `cn()` helper trong `lib/utils.ts`, dùng 68+ lần | — |
| 8 | `@radix-ui/*` (12 packages) | 1.x / 2.x | **GOOD** | — | Tất cả wrapped qua shadcn components | — |
| 9 | `lucide-react` | ^1.14.0 | **GOOD** | — | 20+ usages, icon UI chuẩn, không còn inline SVG icon | — |
| 10 | `swiper` | ^12.1.4 | **GOOD** | — | 5 carousel components (Hero, Featured, Brand, Experience, Video) | — |
| 11 | `@tippyjs/react` | ^4.2.6 | **REMOVE_CANDIDATE** | P1 | **0 import** trong toàn bộ codebase. Radix Tooltip đã thay thế hoàn toàn | `npm uninstall @tippyjs/react tippy.js` |
| 12 | `tippy.js` | ^6.3.7 | **REMOVE_CANDIDATE** | P1 | **0 import** trong toàn bộ codebase | Xem #11 |
| 13 | `react-hook-form` | ^7.74.0 | **GOOD** | — | Tất cả form dùng `useForm` + `zodResolver` | — |
| 14 | `@hookform/resolvers` | ^5.2.2 | **GOOD** | — | Dùng cùng react-hook-form | — |
| 15 | `zod` | ^4.3.6 | **GOOD** | — | Schemas trong `lib/schemas/`, validate form và API response | — |
| 16 | `@tanstack/react-query` | ^5.100.5 | **GOOD** | — | `lib/query/hooks.ts`, `lib/query/keys.ts`, `lib/query/client.ts` | — |
| 17 | `@tanstack/react-query-devtools` | ^5.100.5 | **GOOD** | — | Dev-only via `QueryProvider.tsx` | — |
| 18 | `isomorphic-dompurify` | ^3.11.0 | **GOOD** | — | `lib/utils/html.ts` sanitizeRichHtml, 24 usages, tested | — |
| 19 | `@sentry/nextjs` | ^10.50.0 | **GOOD** | — | 3 Sentry config files + `instrumentation.ts` | — |
| 20 | `pino` | ^10.3.1 | **GOOD** | — | `lib/logger.ts`, server-side logging | — |
| 21 | `pino-pretty` | ^13.1.3 | **GOOD** | — | Dev transport in `lib/logger.ts` | — |
| 22 | `@t3-oss/env-nextjs` | ^0.13.11 | **PARTIAL** | P1 | `env.ts` tồn tại nhưng 4 biến đang dùng chưa được đăng ký. 13 files bypass `env.ts` dùng `process.env` trực tiếp | Xem mục "ENV GAPS" bên dưới |
| 23 | `vitest` | ^4.1.5 | **GOOD** | — | `vitest.config.ts`, 11 test files trong `__tests__/` | — |
| 24 | `@vitest/coverage-v8` | ^4.1.5 | **GOOD** | — | Coverage config trong vitest.config.ts | — |
| 25 | `@testing-library/react` | ^16.3.2 | **PARTIAL** | P2 | Chỉ 1 component test (`ReviewsSection.test.tsx`). Phần lớn là unit test cho utils/schemas | Bổ sung component tests theo roadmap |
| 26 | `@testing-library/jest-dom` | ^6.9.1 | **GOOD** | — | Setup trong vitest.setup.ts | — |
| 27 | `@testing-library/user-event` | ^14.6.1 | **PARTIAL** | P2 | Installed nhưng chưa dùng trong tests hiện tại | Dùng khi viết interaction tests |
| 28 | `jsdom` | ^29.1.0 | **GOOD** | — | vitest environment | — |
| 29 | `@playwright/test` | ^1.60.0 | **PARTIAL** | P2 | Installed nhưng không có `playwright.config.ts`. Chưa có e2e test nào | Tạo config + smoke tests |
| 30 | `eslint` | ^9 | **GOOD** | — | `eslint.config.mjs` | — |
| 31 | `eslint-config-next` | 16.2.4 | **GOOD** | — | Sử dụng trong eslint config | — |

---

## Chi tiết vấn đề: ENV GAPS (P1)

### Biến dùng trong code nhưng chưa đăng ký trong `env.ts`

| Biến | Loại | Dùng ở đâu | Severity |
|------|------|------------|----------|
| `NEXT_PUBLIC_SITE_URL` | client | `lib/utils/routes.ts:2` | P1 |
| `BIGBIKE_SITE_URL` | server | `lib/utils/routes.ts:3` | P1 |
| `INTERNAL_API_TOKEN` | server | `proxy.ts:26` | P1 |
| `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` | server | `proxy.ts:19` | P1 |

### Files dùng `process.env` trực tiếp thay vì `env` module (phần app code)

| File | Biến | Loại file | Safe to Fix |
|------|------|-----------|-------------|
| `lib/api/public-api.ts:22-23` | `BIGBIKE_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` | Server lib | ✓ |
| `lib/api/client-api.ts:23` | `NEXT_PUBLIC_API_BASE_URL` | Client lib | ✓ |
| `app/bao-hanh/WarrantyContent.tsx:8` | `NEXT_PUBLIC_API_BASE_URL` | Client component | ✓ |
| `app/xac-nhan-email/page.tsx:11` | `NEXT_PUBLIC_API_BASE_URL` | Client component | ✓ |
| `app/layout.tsx:54` | `NEXT_PUBLIC_GTM_ID` | Server component | ✓ |
| `app/api/products/[id]/variants/route.ts:6-8` | `BIGBIKE_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL` | Route Handler | ✓ |
| `app/api/products/[id]/stock/route.ts:6-8` | same | Route Handler | ✓ |
| `app/api/products/[id]/snapshot/route.ts:6-8` | same | Route Handler | ✓ |
| `app/api/products/[id]/reviews/route.ts:6-8` | same | Route Handler | ✓ |
| `app/api/products/[id]/pricing/route.ts:6-8` | same | Route Handler | ✓ |
| `app/api/search-suggest/route.ts:6-8` | same | Route Handler | ✓ |
| `app/api/revalidate/route.ts:6` | `REVALIDATE_SECRET`, `WEB_REVALIDATE_SECRET` | Route Handler | ✓ |

### Files được phép dùng `process.env` trực tiếp (không cần sửa)

| File | Lý do |
|------|-------|
| `env.ts` | Đây là file khai báo `runtimeEnv` — bắt buộc dùng `process.env` trực tiếp |
| `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` | Sentry docs yêu cầu dùng `process.env` trực tiếp trong config files |
| `next.config.ts` | Next.js config file, chạy trước khi `env.ts` được load |
| `instrumentation.ts` | Đọc `NEXT_RUNTIME` — runtime flag của Next.js, không phải app env var |
| `proxy.ts` | Edge runtime — `env.ts` từ t3-oss cần kiểm tra edge compat trước khi migrate; cũng có `console.warn/error` không thể dùng pino trong edge |
| `lib/logger.ts` | Dùng `process.env.NODE_ENV` để config pino — chạy rất sớm trước env validation; an toàn vì NODE_ENV luôn có |
| `components/providers/QueryProvider.tsx` | `"use client"` — Next.js inline `NODE_ENV` compile-time, không cần env module |
| `app/error.tsx` | `"use client"` — NODE_ENV là build-time constant, không thể dùng server env module |
| `scripts/*` | Standalone ETL scripts, không phải app code |
| `lib/utils/routes.ts` | Cross-runtime (server + client) — `BIGBIKE_SITE_URL` chỉ dùng server-side, `NEXT_PUBLIC_SITE_URL` được thêm vào env.ts |

---

## Chi tiết vấn đề: UNUSED DEPENDENCIES (P1)

### `tippy.js` + `@tippyjs/react`

```
$ grep -r "tippy\|@tippyjs" bigbike-web/app bigbike-web/components bigbike-web/lib --include="*.ts" --include="*.tsx"
# → 0 matches
```

Radix Tooltip (`@radix-ui/react-tooltip`) đã thay thế hoàn toàn. Tippy chưa được dùng ở bất kỳ đâu.

**Action:** `npm uninstall tippy.js @tippyjs/react`  
**Risk:** Không có risk — 0 imports, 0 usages.

---

## Chi tiết vấn đề: PARTIAL COVERAGE

### `@playwright/test` — installed, no config

Playwright được cài nhưng không có `playwright.config.ts`. Chưa có e2e test nào.

**Action (roadmap):** Tạo `playwright.config.ts` + smoke tests cho critical paths:
- Trang chủ render được
- Product listing page
- Product detail page
- Login/Register flow
- Cart flow

**Risk:** P2 — không ảnh hưởng hiện tại.

### `class-variance-authority` — chỉ dùng 3 nơi

CVA được install đúng mục đích nhưng chỉ dùng trong `button.tsx`, `badge.tsx`, `sheet.tsx`. Đây không phải vấn đề — không phải mọi component đều cần CVA. Chỉ cần khi component có nhiều visual variants.

**Action (roadmap):** Khi tạo component mới có >= 2 visual variants → dùng CVA.

### `@testing-library/user-event` — installed, minimal usage

Installed đúng nhưng chưa có nhiều interaction tests. Cần bổ sung khi viết component tests.

---

## Vấn đề phát hiện thêm (không liên quan thư viện)

### `console.error` trong `proxy.ts` (không dùng pino)

`proxy.ts` (Edge runtime) có `console.error` và `console.warn`. Không thể dùng pino vì pino không tương thích Edge runtime. **Chấp nhận được** — Edge runtime có giới hạn.

### `console.error` trong `lib/utils/routes.ts:11`

Server-side only (guarded by `globalThis.window === undefined`). Dùng `console.error` thay vì `logger`. Có thể sửa nhưng có rủi ro client bundle vì file này cross-runtime.

**Action:** Ghi nhận, để trong roadmap batch tiếp theo.

---

## Fixes đã thực hiện (Phase 2)

- [x] `env.ts` — thêm `NEXT_PUBLIC_SITE_URL`, `BIGBIKE_SITE_URL`, `INTERNAL_API_TOKEN`, `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS`
- [x] `lib/api/public-api.ts` — dùng `env` thay `process.env`
- [x] `lib/api/client-api.ts` — dùng `env` thay `process.env`
- [x] `app/layout.tsx` — dùng `env.NEXT_PUBLIC_GTM_ID`
- [x] `app/bao-hanh/WarrantyContent.tsx` — dùng `env.NEXT_PUBLIC_API_BASE_URL`
- [x] `app/xac-nhan-email/page.tsx` — dùng `env.NEXT_PUBLIC_API_BASE_URL`
- [x] `app/api/products/[id]/variants/route.ts` — dùng `env`
- [x] `app/api/products/[id]/stock/route.ts` — dùng `env`
- [x] `app/api/products/[id]/snapshot/route.ts` — dùng `env`
- [x] `app/api/products/[id]/reviews/route.ts` — dùng `env`
- [x] `app/api/products/[id]/pricing/route.ts` — dùng `env`
- [x] `app/api/search-suggest/route.ts` — dùng `env`
- [x] `app/api/revalidate/route.ts` — dùng `env`
- [x] Remove `tippy.js` + `@tippyjs/react` — 0 usages confirmed

---

## Vấn đề chưa fix (cần xem xét riêng)

| Vấn đề | Lý do chưa fix | Recommended Action |
|--------|---------------|-------------------|
| `proxy.ts` — dùng `process.env` trực tiếp | Edge runtime, cần kiểm tra t3-oss edge compat | Test riêng trước khi migrate |
| `lib/utils/routes.ts:11` — `console.error` thay vì logger | Cross-runtime file, import logger vào đây gây nguy cơ server-only module trong client bundle | Tách server-only logic sang một file riêng |
| Playwright — không có config/tests | Cần thiết kế test plan trước | Xem LIBRARY_STANDARDIZATION_ROADMAP.md |
| Legacy CSS — 1,583 class trong `globals.css` | Quá rộng, cần migrate từng batch | Xem LIBRARY_STANDARDIZATION_ROADMAP.md |
| Component tests — chỉ có 1 component test | Cần mở rộng coverage | Xem LIBRARY_STANDARDIZATION_ROADMAP.md |
