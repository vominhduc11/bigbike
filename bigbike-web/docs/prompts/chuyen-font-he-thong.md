# Prompt cho Claude Code — Chuyển toàn bộ font bigbike-web sang font hệ thống (Arial / Helvetica)

> Copy nguyên khối bên dưới và đưa cho Claude Code chạy trong repo `bigbike-web`.

---

## Mục tiêu

Thay toàn bộ typography của dự án từ superfamily **Barlow / Barlow Condensed** (đang nạp qua `next/font/google`) sang **font hệ thống Arial / Helvetica**. Sau khi hoàn tất, dự án **không còn tải bất kỳ webfont Barlow nào**; mọi text render bằng font hệ thống của máy người dùng.

## Bối cảnh kiến trúc (đã khảo sát — sửa tập trung, KHÔNG sửa rải rác từng component)

Font được quản lý qua một chuỗi token tập trung:

- `app/fonts.ts` — nạp `Barlow` + `Barlow_Condensed`, expose biến `--font-barlow`, `--font-barlow-condensed`.
- `app/layout.tsx` — gắn `${barlow.variable} ${barlowCondensed.variable}` vào className của `<html>`.
- `styles/brand-tokens.css` (≈ dòng 114–119) — định nghĩa 6 token họ chữ: `--bb-font-display`, `--bb-font-heading`, `--bb-font-body`, `--bb-font-link`, `--bb-font-cta`, `--bb-font-nav`.
- `app/globals.css` khối `@theme inline` (≈ dòng 90–94) — map `--font-display/body/heading/cta/nav`. ⚠️ Dòng 90 là `--font-display: var(--font-barlow-condensed);` — trỏ **thẳng** vào biến Barlow, không qua token `--bb-*`.
- `docs/TYPOGRAPHY.md` — tài liệu chuẩn (source of truth) của typography.
- Toàn bộ CSS dùng `font-family: var(--bb-font-*)` → đổi token là đổi toàn site.

## Stack font hệ thống cần dùng

Dùng **một stack thống nhất** cho cả 6 token (Arial/Helvetica hỗ trợ đầy đủ dấu tiếng Việt):

```
Arial, Helvetica, "Helvetica Neue", sans-serif
```

## Các thay đổi bắt buộc

1. **`styles/brand-tokens.css`** — đổi cả 6 token `--bb-font-*` sang stack trên:
   ```css
   --bb-font-display: Arial, Helvetica, "Helvetica Neue", sans-serif;
   --bb-font-heading: Arial, Helvetica, "Helvetica Neue", sans-serif;
   --bb-font-body:    Arial, Helvetica, "Helvetica Neue", sans-serif;
   --bb-font-link:    Arial, Helvetica, "Helvetica Neue", sans-serif;
   --bb-font-cta:     Arial, Helvetica, "Helvetica Neue", sans-serif;
   --bb-font-nav:     Arial, Helvetica, "Helvetica Neue", sans-serif;
   ```
   Cập nhật luôn comment "superfamily Barlow" ở trên cụm token này cho khớp.

2. **`app/globals.css`** — sửa `--font-display: var(--font-barlow-condensed);` → `--font-display: var(--bb-font-display);`. (Bắt buộc: không được để trỏ vào biến Barlow đã bị gỡ, nếu không sẽ resolve rỗng và display mất font.)

3. **`app/fonts.ts`** — gỡ `import { Barlow, Barlow_Condensed } from "next/font/google"` và 2 khai báo `barlow` / `barlowCondensed`. Nếu sau khi gỡ file không còn export nào được dùng → xóa file.

4. **`app/layout.tsx`** — gỡ dòng `import { barlow, barlowCondensed } from "./fonts"` và bỏ `${barlow.variable} ${barlowCondensed.variable}` khỏi className của `<html>` (giữ lại `h-full antialiased` và các class khác).

5. **`docs/TYPOGRAPHY.md`** — cập nhật mục 1–4 để phản ánh việc chuyển sang Arial/Helvetica: bỏ phần `next/font`, bảng vai trò Barlow/Barlow Condensed, và danh sách weight Barlow. Nêu rõ hệ thống nay dùng font hệ thống.

## Ràng buộc — GIỮ NGUYÊN, không được đụng

- Giữ `font-family: monospace` cho mã đơn hàng (`app/globals.css` ~ dòng 1478, `.bb-order-head .meta b`).
- Giữ nguyên font icon **icomoon** (self-host).
- Giữ toàn bộ `--fs-*` (font-size clamp), `text-transform: uppercase`, `letter-spacing`, `font-weight` của heading/nav/CTA — **chỉ đổi `font-family`**. Lưu ý: heading sẽ mất dáng condensed và render bằng Arial (đậm ở 600/700) — đây là kết quả mong đợi của yêu cầu "font hệ thống".
- Không đổi logic, layout, spacing, màu sắc.

## Kiểm tra (bắt buộc chạy hết và báo kết quả)

1. `grep -rni "barlow" app components styles lib --include=*.ts --include=*.tsx --include=*.css` → 0 kết quả còn sót.
2. `grep -rn "next/font" app/` → không còn.
3. `grep -rn "font-barlow" app styles` → không còn biến nào được tham chiếu.
4. Build: `npm run build` → pass (kiểm luôn typecheck).
5. Lint: `npm run lint` → pass.
6. Nếu tồn tại: `node scripts/verify-typography-computed.mjs` và các test typography (`npm run test`, e2e nếu cần) → pass.
7. Xác nhận trực quan (`npm run dev`): `<body>`, heading, nav, button đều render Arial/Helvetica; không FOUT, không khoảng trắng do biến font thiếu.

## Đầu ra

Liệt kê danh sách file đã sửa kèm diff tóm tắt, và kết quả từng bước kiểm tra ở trên.
