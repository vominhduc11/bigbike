---
name: hygiene
description: "Dùng trước khi finalize thay đổi UI hoặc text trong bigbike-web hoặc bigbike-admin để bắt lỗi cơ học mà CI và contract quan tâm: dead CSS theo quy trình rg-trước-khi-xóa, mojibake hoặc tiếng Việt mất dấu, và business-data legacy hardcode như email, phone hoặc địa chỉ mà guard script chặn."
---

# hygiene — Quét dead CSS, mojibake, business-data hardcode

Ba loại lỗi cơ học, dễ quên, nhưng CI/contract bắt. Quét trên file đã đổi (hoặc theo yêu cầu).

## 1. Dead CSS — rg trước khi xóa

Dead CSS = class định nghĩa trong `.css` nhưng không `.jsx/.tsx/.js/.ts` nào reference.

```powershell
# Xác nhận một class cụ thể trước khi kết luận dead (chạy từ root repo)
rg -n "ten-class" bigbike-admin/src -g "*.jsx" -g "*.tsx" -g "*.js"
rg -n "ten-class" bigbike-web -g "*.jsx" -g "*.tsx" -g "*.js" -g "*.ts"
```

- `rg` ra kết quả → đang dùng → giữ.
- `rg` ra 0 kết quả → dead → **xóa ngay trong cùng task**, không ghi TODO.

**Ngoại lệ KHÔNG tính dead:** selector third-party (`.tiptap`, `.recharts-*`, `.rdp-*`), class set qua `classList.add`/`element.className` trong JS, `@keyframes` (chỉ dead nếu không có `animation`/`animation-name` reference cùng file).

**bigbike-admin có 2 hệ CSS song song — không nhầm:**
- `src/index.css` + `src/styles/admin-layout.css` → mới, production, active (class không prefix).
- `src/styles/admin-prototype.css` → legacy `bb-*`, **vẫn active** (dùng bởi `AdminShell`, `DashboardScreen`, `LoginScreen`…). KHÔNG giả định dead mà không grep. **KHÔNG thêm class mới** vào file này.

## 2. Mojibake & tiếng Việt mất dấu

Mọi text UI (JSX content, string literal, placeholder, aria-label, alt, toast, log, comment) phải UTF-8, có dấu đầy đủ, không vỡ mã.

```powershell
# Tìm dấu hiệu mojibake / unicode escape thủ công trong file đã đổi
rg -n "\x{00C3}|\x{00C2}|\x{00E1}\x{00BA}|\x{00E2}\x{20AC}|\x{FFFD}|&#[0-9]+;" bigbike-web/app bigbike-web/components bigbike-admin/src -g "*.tsx" -g "*.jsx" -g "*.ts" -g "*.js"
```

- Chuỗi nhìn như chữ bị vỡ mã, HTML numeric escape dạng ampersand-hash-number-semicolon, hoặc ký tự replacement `U+FFFD` → phải sửa thành tiếng Việt thẳng UTF-8.
- Tiếng Việt mất dấu (`Thanh toan`, `San pham noi bat`) khó tự động hóa hoàn toàn → **đọc mắt các string UI vừa thêm/sửa**, đảm bảo có dấu.

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
