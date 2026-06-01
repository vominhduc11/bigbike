# Prompt cho Claude Code — Thiết kế lại toàn bộ UI/UX cho `bigbike-admin`

> Cách dùng: giải nén `bigbike-admin.zip` vào repo tại `design-reference/bigbike-admin-design/`
> (để nguyên cấu trúc: `tokens.css`, `app.css`, `shell.js`, `Foundation.html`, `dashboard.html`,
> `product-list.html`, `product-detail.html`, `assets/`). Sau đó mở Claude Code ở thư mục repo và
> dán toàn bộ phần dưới đây. Có thể thêm `design-reference/` vào `.gitignore` nếu không muốn commit.

---

## 0. Bối cảnh
Đây là repo **`bigbike-admin`** đang chạy thật: **Vite + React 19 + Tailwind v4 + shadcn/ui + Radix + lucide-react**, dữ liệu qua **@tanstack/react-query**, đa ngôn ngữ bằng **react-i18next**, có **Playwright e2e**. **Dự án đã kết nối backend thật và đang hoạt động.**

Thư mục **`design-reference/bigbike-admin-design/`** chứa **prototype tĩnh (HTML/CSS/JS)** mà tôi đã thiết kế lại — **đây là NGUỒN SỰ THẬT (source of truth) cho giao diện mới**:
- `tokens.css` — design tokens + component tái dùng (button, badge, field, kpi, table, tabs, dialog, toast, empty, note…).
- `app.css` — app shell + style cho màn hình (sidebar tối, topbar, breadcrumb, content).
- `shell.js` — JS bơm sidebar/topbar/breadcrumb, drawer, toast (logic chỉ để demo).
- `Foundation.html` — tài liệu design system.
- `dashboard.html`, `product-list.html`, `product-detail.html` — 3 màn mẫu chuẩn.

## 1. Mục tiêu
Áp **đồng nhất** ngôn ngữ thiết kế mới này lên **TOÀN BỘ UI/UX** của admin (tất cả màn hình, component dùng chung, shell) — **NHƯNG tuyệt đối KHÔNG thay đổi logic nghiệp vụ**, vì backend đã kết nối và đang chạy.

## 2. Ràng buộc TUYỆT ĐỐI (không được vi phạm)
- ❌ **Không** sửa logic gọi API / hooks react-query / service / data fetching.
- ❌ **Không** đổi shape dữ liệu, "data props", **zod schema** (`src/lib/schemas.js`), validation, tính toán.
- ❌ **Không** đổi routing / luồng điều hướng trong `src/App.jsx` (chỉ được đổi phần trình bày).
- ❌ **Không** đổi key i18n / nội dung trong `src/locales`. Nếu thêm chuỗi mới, phải thêm cho **mọi** ngôn ngữ và dùng cơ chế i18n có sẵn (không hardcode chữ).
- ❌ **Không** đưa mock / dữ liệu giả vào runtime — phải giữ `npm run check:no-runtime-mock` **xanh** (script `scripts/check-no-admin-runtime-mock.mjs`).
- ✅ **Giữ nguyên** mọi `data-testid`, `aria-label`, accessible name, `role` mà Playwright e2e dựa vào. Nếu buộc phải đổi do thiết kế, **cập nhật test tương ứng** và nêu rõ lý do.
- ✅ Chỉ đụng vào **lớp trình bày**: JSX/markup, `className`, CSS/token, và phần thuần-giao-diện của component UI.

👉 Nguyên tắc vàng: nếu không chắc một đoạn là **logic** hay **trình bày** → **hỏi tôi trước**, đừng tự sửa.

## 3. Hệ thiết kế mới — những điểm mấu chốt
1. **Primary = Direction B (CAM)** `--primary:#cc4a08` (dark: `#f0791f`) — *đã duyệt*. Màu **đỏ `#e8281e` chỉ còn là màu thương hiệu** (logo, vạch active của sidebar, vài badge), **không** dùng làm màu primary/CTA.
   - ⚠️ Hiện `src/styles/admin-tokens.css` đang map `--primary` về **đỏ**, và `src/index.css` map token shadcn (`--primary`, `--ring`…) theo đó. **Cần cập nhật** để `--primary`/CTA trỏ về **cam Direction B** đúng như `tokens.css` của prototype.
2. Giữ **light + dark** (`data-theme` đã có `ThemeToggle.jsx`). **Bỏ** cơ chế `data-dir` của prototype và **chốt cứng Direction B** (không cần phần Direction A/Graphite).
3. Đồng bộ **toàn bộ token scale** với prototype: surface/border/text, status (success/warning/danger/info/neutral), spacing `--s-*`, radius `--r-*`, shadow `--sh-*`, type scale `--t-*`.
4. Font: **Inter** (body), **Bungee** (display — số KPI, logo), **JetBrains Mono** (mono) — đã cài sẵn qua `@fontsource`, dùng đúng vai trò như prototype.
5. ❌ **Không** port "prototype chrome" (`.proto`, `.proto-bar`, `.proto-stage` — thanh xem thử Desktop/Mobile + nút theme). Đó là giàn giáo của prototype, **không thuộc sản phẩm**.
6. Responsive: prototype dùng **container query** trên `.app-viewport`; trong app dùng breakpoint thật/Tailwind nhưng **giữ hành vi mobile** đã có (sidebar dạng drawer + `MobileCardList`).

## 4. Bảng ánh xạ prototype → repo (đối chiếu khi làm)
| Prototype | Component trong repo |
|---|---|
| App shell: `.app-shell`, `.sidebar` (tối), `.ptopbar`, `.pcrumb` + `shell.js` | `src/components/AdminShell.jsx` |
| `.screen-head`, `.sh-eyebrow`, `.sh-actions` | `src/components/layout/ScreenHeader.jsx`, `layout/Screen.jsx` |
| FilterBar | `layout/FilterBar.jsx` |
| `.sticky-bar` (lưu/hủy) | `layout/StickyActionBar.jsx` |
| KPI `.kpi` | `layout/SummaryCard.jsx` |
| `.tabs` / `.tab` | `layout/Tabs.jsx` + `ui/tabs.jsx` |
| Table `.tbl` (+ `.compact`, `.prod-cell`, `.row-actions`, `.icon-btn`) | `components/AdminTable.jsx` + `ui/table.jsx` |
| Dialog `.dialog` | `components/ConfirmDialog.jsx`, `layout/Modal.jsx` + `ui/dialog.jsx` |
| Form `.field` | `layout/FormField.jsx` + `ui/input,label,textarea,select,checkbox,radio-group` |
| Button `.btn` (primary/secondary/ghost/danger/sm) | `ui/button.jsx` |
| Badge `.badge` (success/warning/danger/info/neutral) | `ui/badge.jsx`, `components/StatusBadge.jsx` |
| Empty `.empty` | `components/StatePanel.jsx` |
| Toast `.toast` | cấu hình `sonner` |
| Note callout `.note` | callout dùng chung |

**Lưu ý nav:** repo có **nhiều màn hơn** prototype (Inventory, Receivables, Warranty, Serial, Reports, Shipping, Redirects, Newsletter, AuditLog…). Hãy mở rộng sidebar/nav theo **cùng ngôn ngữ thiết kế** (nhóm: Bán hàng / Danh mục / Nội dung / Hệ thống) thay vì chỉ copy y hệt prototype.

## 5. Quy trình thực hiện (theo phase — DỪNG chờ tôi duyệt sau Phase 0)
**Phase 0 — Khảo sát & lập kế hoạch (KHÔNG sửa code).** Đọc `design-reference/` và toàn bộ `src/`, rồi trình bày:
- (a) Bảng ánh xạ prototype → component thực tế (bổ sung/đính chính bảng ở mục 4).
- (b) Danh sách **tất cả màn** trong `src/screens` + đề xuất chia **lô migrate** và thứ tự.
- (c) Danh sách khác biệt token giữa `admin-tokens.css` hiện tại và prototype (nhất là **đỏ → cam**).
- (d) Rủi ro với Playwright e2e (selector/snapshot có thể vỡ) + cách xử lý.
👉 **Chờ tôi duyệt kế hoạch rồi mới sang Phase 1.**

**Phase 1 — Nền tảng.** Cập nhật token (cam Direction B) + mapping shadcn + dark mode; dựng lại `AdminShell` (sidebar/topbar/breadcrumb) khớp prototype; chuẩn hóa component dùng chung trong `ui/` và `layout/`. Chạy `npm run lint && npm run build`; xem thử vài màn ở light/dark + mobile.

**Phase 2 — Migrate màn hình theo lô (commit riêng từng lô).** Bắt đầu bằng 3 màn đã có trong prototype — **Dashboard, ProductList, ProductDetail** — làm "chuẩn vàng", rồi lan ra các nhóm còn lại. Mỗi màn: **chỉ đổi trình bày**, giữ nguyên hook/handler/data/route. Sau mỗi lô chạy `lint` + `build` (+ `e2e` nếu chạy được).

**Phase 3 — Nghiệm thu.** Rà toàn bộ màn ở light/dark + desktop/mobile cho nhất quán; chạy `npm run lint`, `npm run build`, `npm run test:e2e`; nếu test vỡ do đổi giao diện thì chỉ chỉnh **selector/snapshot** một cách hợp lý, **giữ nguyên ý nghĩa test**. Cuối cùng báo cáo tóm tắt thay đổi theo file.

## 6. Cách làm việc an toàn
- Tạo nhánh `redesign/ui-ux` (đừng commit thẳng `main`).
- Commit nhỏ, mô tả rõ; **mỗi màn/nhóm một commit** để dễ review & revert.
- Sau mỗi bước, **build phải xanh**; không phá `check:no-runtime-mock`.
- **Không** thêm thư viện UI mới nếu không thật cần (đã có shadcn/Radix/lucide/recharts/sonner/tiptap/dnd-kit).
- Tái dùng tối đa component sẵn có; tránh viết lại trùng lặp.

## 7. Tiêu chí hoàn thành (Definition of Done)
- Mọi màn dùng đúng **token cam Direction B**, **shell mới**, **component dùng chung**; light/dark + responsive chạy tốt.
- **Không đổi hành vi**: API, dữ liệu, route, form, i18n giữ nguyên; e2e xanh (hoặc chỉ chỉnh selector/snapshot có giải trình).
- `npm run lint` và `npm run build` **xanh**; `check:no-runtime-mock` **xanh**.

## 8. Trước khi bắt đầu — hãy hỏi lại nếu cần
Nếu còn điểm chưa rõ (ví dụ: giữ cả light/dark hay chỉ light? thứ tự ưu tiên nhóm màn? có được phép cập nhật e2e snapshot không?), **hãy hỏi tôi bằng câu hỏi ngắn kèm lựa chọn (option) trước khi sửa code.**
