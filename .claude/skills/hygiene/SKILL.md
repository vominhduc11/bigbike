---
name: hygiene
description: Dùng trước khi finalize thay đổi UI/text trong bigbike-web hoặc bigbike-admin để bắt các lỗi cơ học mà CI và contract quan tâm — dead CSS (theo đúng quy trình grep-trước-khi-xóa), mojibake hoặc tiếng Việt mất dấu, và business-data legacy hardcode (email/phone/địa chỉ) mà guard script chặn. Gọi bằng /hygiene.
---

# /hygiene — Quét dead CSS, mojibake, business-data hardcode

Ba loại lỗi cơ học, dễ quên, nhưng CI/contract bắt. Quét trên file đã đổi (hoặc theo yêu cầu).

## 1. Dead CSS — grep trước khi xóa

Dead CSS = class định nghĩa trong `.css` nhưng không `.jsx/.tsx/.js/.ts` nào reference.

```bash
# Xác nhận một class cụ thể trước khi kết luận dead (chạy từ root repo)
grep -rn "ten-class" bigbike-admin/src --include="*.jsx" --include="*.tsx" --include="*.js"
grep -rn "ten-class" bigbike-web --include="*.jsx" --include="*.tsx" --include="*.js" --include="*.ts"
```

- Grep ra kết quả → đang dùng → giữ.
- Grep ra 0 kết quả → dead → **xóa ngay trong cùng task**, không ghi TODO.

**Ngoại lệ KHÔNG tính dead:** selector third-party (`.tiptap`, `.recharts-*`, `.rdp-*`), class set qua `classList.add`/`element.className` trong JS, `@keyframes` (chỉ dead nếu không có `animation`/`animation-name` reference cùng file).

**bigbike-admin có 2 hệ CSS song song — không nhầm:**
- `src/index.css` + `src/styles/admin-layout.css` → mới, production, active (class không prefix).
- `src/styles/admin-prototype.css` → legacy `bb-*`, **vẫn active** (dùng bởi `AdminShell`, `DashboardScreen`, `LoginScreen`…). KHÔNG giả định dead mà không grep. **KHÔNG thêm class mới** vào file này.

## 2. Mojibake & tiếng Việt mất dấu

Mọi text UI (JSX content, string literal, placeholder, aria-label, alt, toast, log, comment) phải UTF-8, có dấu đầy đủ, không vỡ mã.

```bash
# Tìm dấu hiệu mojibake / unicode escape thủ công trong file đã đổi
grep -rnP "Ã|Â|áº|â€|�|&#[0-9]+;" bigbike-web/app bigbike-web/components bigbike-admin/src \
  --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js"
```

- `ThÃ nh toÃ¡n`, `Gi&#7843;m`, `�` → vỡ mã, phải sửa thành tiếng Việt thẳng UTF-8.
- Tiếng Việt mất dấu (`Thanh toan`, `San pham noi bat`) khó grep tự động → **đọc mắt các string UI vừa thêm/sửa**, đảm bảo có dấu.

## 3. Business-data hardcode (guard script chặn)

Data phải đến từ backend, không hardcode legacy storefront data vào runtime. Guard script chạy trong `npm run lint`:

```bash
(cd bigbike-web && npm run lint)     # chạy check:no-runtime-business-data
(cd bigbike-admin && npm run lint)   # chạy check:no-admin-runtime-mock
```

Pattern legacy bị cấm (ví dụ): email/phone/địa chỉ storefront cũ, fixture `WP_*`, `HOME_FAQS`, mock helper (`withMockFallback`, `mockData`, `getMock*`). Nếu lint fail vì pattern này → gỡ data hardcode, lấy từ API thật.

## Output

Báo cáo gọn theo `file:line`:
- Dead CSS tìm thấy + đã xóa (kèm class).
- Mojibake / mất dấu + đã sửa.
- Guard script: pass / fail (nếu fail, liệt kê pattern vi phạm).
