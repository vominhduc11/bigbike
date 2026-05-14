# BigBike Web Design System Consistency Audit

Ngày kiểm tra: 2026-05-13

Phạm vi: `bigbike-web` public website.

## 1. Nền tảng Design System hiện tại

BigBike web hiện dựa trên các nguồn sau:

- `bigbike-web/STYLEGUIDE.md`: quy định WP-parity, nền trắng, header/footer tối, CTA đỏ, link xanh, radius vuông, Barlow/Oswald/Barlow Condensed, card sản phẩm 1:1, container tối đa 1200px, touch target tối thiểu 44px.
- `bigbike-web/styles/brand-tokens.css`: token màu, nền, chữ, spacing, radius, shadow, motion, z-index.
- `bigbike-web/app/globals.css`: ánh xạ token sang Tailwind theme inline và base style.
- `bigbike-web/components/ui/*`: button, badge, input, textarea, select, dialog, sheet, dropdown, popover, tooltip, empty/error/loading/media primitives.
- `docs/business/MODULE_CATALOG.md`: xác nhận phạm vi public web gồm catalog, search, cart, checkout, account, page hero/banner và content page.
- `docs/engineering/API_CONTRACT.md` + `docs/engineering/DATA_CONTRACT.md`: dùng làm ranh giới để không đổi API contract, data mapping hoặc shape dữ liệu trong đợt chỉnh UI này.

Ghi chú: `docs/DOCS_VERIFICATION_REPORT.md`, `Bigbike Design System/README.md`, và `Bigbike Design System/colors_and_type.css` không tồn tại trong working tree tại thời điểm audit, nên audit dùng `bigbike-web/STYLEGUIDE.md` và token hiện có trong `bigbike-web/styles/brand-tokens.css` làm căn cứ trực tiếp.

## 2. Nhóm lỗi phát hiện

- Một số shared component còn dùng màu, shadow, duration, z-index hard-code thay vì token.
- Success/warning/error state chưa đồng bộ; có nơi dùng màu riêng, có nơi contrast thấp trên nền sáng.
- Loading skeleton và image fallback còn mang cảm giác dark/gradient, không khớp hướng light-first của web.
- Một số form control dùng native `select`/`textarea`, lệch với quy tắc shadcn/Radix trong `AGENTS.md`.
- Footer và drawer còn dùng màu riêng, text phụ có contrast thấp.
- Một số page có inline style cho màu/trạng thái, khiến visual language không đồng nhất.
- Star rating, badge, modal overlay, focus ring và transition duration chưa dùng chung một hệ token.

## 3. File/component đã sửa

- Token/foundation:
  - `bigbike-web/styles/brand-tokens.css`
  - `bigbike-web/app/globals.css`
- Shared UI primitives:
  - `bigbike-web/components/ui/button.tsx`
  - `bigbike-web/components/ui/badge.tsx`
  - `bigbike-web/components/ui/input.tsx`
  - `bigbike-web/components/ui/textarea.tsx`
  - `bigbike-web/components/ui/select.tsx`
  - `bigbike-web/components/ui/dialog.tsx`
  - `bigbike-web/components/ui/sheet.tsx`
  - `bigbike-web/components/ui/dropdown-menu.tsx`
  - `bigbike-web/components/ui/popover.tsx`
  - `bigbike-web/components/ui/tooltip.tsx`
  - `bigbike-web/components/ui/EmptyState.tsx`
  - `bigbike-web/components/ui/ErrorState.tsx`
  - `bigbike-web/components/ui/LoadingGrid.tsx`
  - `bigbike-web/components/ui/MediaImage.tsx`
- Layout/form/page components:
  - `bigbike-web/components/layout/SiteFooter.tsx`
  - `bigbike-web/components/layout/MobileHeaderMenu.tsx`
  - `bigbike-web/components/contact/ContactForm.tsx`
  - `bigbike-web/components/catalog/QuickBuyModal.tsx`
  - `bigbike-web/components/catalog/PricingPanel.tsx`
  - `bigbike-web/components/catalog/PurchaseSectionClient.tsx`
  - `bigbike-web/components/catalog/ReviewsSection.tsx`
  - `bigbike-web/components/home/ExperienceCarousel.tsx`
  - `bigbike-web/components/search/SearchScopeSelect.tsx`
  - `bigbike-web/app/tim-kiem/page.tsx`
  - `bigbike-web/app/xac-nhan-email/page.tsx`
  - `bigbike-web/app/bao-hanh/page.tsx`
  - `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx`
  - `bigbike-web/app/tai-khoan/edit-address/[type]/page.tsx`

## 4. Pattern đã chuẩn hóa

- Button, form, focus ring và motion dùng duration/easing/focus token chung.
- Badge và trạng thái success/warning/error dùng semantic token thay vì màu lẻ.
- Loading skeleton, empty state, error state và media fallback dùng cùng surface/border/text token.
- Modal, sheet, popover, dropdown và tooltip dùng chung z-index, overlay, shadow, background token.
- Search scope chuyển sang shared Radix/shadcn select nhưng vẫn giữ payload form submit hiện tại.
- Quick buy modal chuyển native control sang shared `Textarea` và `Select`.
- Footer/drawer chuyển về token màu tối của brand, tăng contrast cho text phụ.
- Inline style màu ở các page quan trọng được thay bằng utility/token thống nhất.

## 5. Điểm chưa fix trong đợt này

- Worktree trước khi audit đã có nhiều thay đổi và xóa file ngoài phạm vi `bigbike-web`; các thay đổi đó được giữ nguyên.
- Một vài màu hard-code còn lại là màu nhận diện bên thứ ba hoặc dữ liệu thật, không phải token UI BigBike: icon Zalo/Facebook/Messenger trong floating chat và swatch màu sản phẩm trong filter.
- `app/layout.tsx` vẫn giữ `themeColor` đen/trắng cho metadata trình duyệt; đây không phải style component.
- Đợt này không đổi API, data mapping, business flow, route hoặc SEO contract.

## 6. Kết quả kiểm tra

Theo `docs/engineering/TESTING_GUIDE.md`, các lệnh kiểm tra cho web đã chạy:

- `npm run lint`: PASS, còn 2 warning không chặn build:
  - `app/thanh-toan/page.tsx`: React Hook Form `watch()` bị React Compiler cảnh báo là incompatible library.
  - `scripts/verify-typography-computed.mjs`: biến `err` chưa dùng.
- `npx tsc --noEmit`: PASS.
- `npm run test`: PASS, 12 test file / 95 test.
- `npm run build`: PASS.
- Visual smoke chính: PASS trên `http://localhost:3010` với desktop 1440x1000 và mobile 390x844 cho `/`, `/san-pham/`, PDP mẫu, `/tim-kiem/?q=mu`, `/gio-hang/`, `/xac-nhan-email/?token=invalid`, và 404 fallback. Ảnh và kết quả lưu ở `bigbike-web/output/playwright/`.

Ghi chú kiểm tra visual: console có lỗi CORS tới `http://localhost:8080/api/v1/customer/me`, `cart`, và `verify-email` vì smoke server chạy trên port 3010 trong khi backend local không cho origin này. Trang vẫn render status 200, có nội dung và không trắng/vỡ layout trong phạm vi smoke.
