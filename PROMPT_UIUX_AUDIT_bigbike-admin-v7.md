# Prompt Audit UI/UX — bigbike-admin (v7 — BẢN CHỐT)

> **Cập nhật v3:** bổ sung **Nhóm 6 — Operational Efficiency (O1–O10)**, nâng tổng số tiêu chí từ 38 lên **48**, phân theo **6 nhóm**. Lý do: admin là business user nội bộ, thao tác cần dễ dàng — nhanh — hiệu quả, khác với end-user thông thường.
>
> **Cập nhật v4:** bổ sung **F10–F13** (Form & Nhập liệu) và **T11** (Danh sách & Bảng dữ liệu), nâng tổng số tiêu chí từ 48 lên **53**. Lý do: chuẩn hoá nguyên tắc "giảm thao tác nhưng vẫn chính xác" cho mọi entity có nhiều field/dữ liệu lặp (không riêng Sản phẩm) — progressive disclosure, nhân bản, auto-derive field, bảng ma trận cho dữ liệu con lặp cấu trúc.
>
> **Cập nhật v5:** tổng quát hoá Phase 0 — bỏ giả định cứng về tên file/thư mục (do chưa có codebase thực tế để xác nhận), chuyển sang cơ chế Claude Code tự khám phá cấu trúc thật trước khi audit. Sửa `main.tsx`/`App.tsx` (giả định sai TypeScript) thành đúng thực tế dự án là JavaScript.
>
> **Cập nhật v6:** bổ sung **Nhóm 7 — Visual Hierarchy & Consistency (V1–V4)**. Lý do: admin cần nhìn hiểu nhanh trong vài giây, giao diện gọn gàng, khối/thẻ căn chỉnh đều — dựa trên nguyên tắc visual hierarchy và hệ lưới spacing 8pt. **Đồng thời sửa lỗi đếm tồn tại từ bản gốc**: tổng ghi "38" ở v2 trên thực tế là 42 (L8+T10+F9+N7+A8 = 42), lỗi cộng dồn qua v3 (48→đúng ra 52) và v4 (53→đúng ra 57). Tổng đúng của v6: 61 tiêu chí, 7 nhóm (L8+T11+F13+N7+A8+O10+V4).
>
> **Cập nhật v7 (BẢN CHỐT):** bổ sung **V5** — label/ngôn ngữ rõ ràng, nhất quán. Tổng đúng: **62 tiêu chí, 7 nhóm** (L8+T11+F13+N7+A8+O10+V5). Đây là bản duy nhất cần dùng — các bản v2–v6 đã lỗi thời, nên xoá.

Dự án là admin dashboard dạng SPA — **Vite + React (JavaScript, không phải TypeScript)**, React Router (hoặc router tương đương), Tailwind CSS/design system nội bộ. Số lượng module cụ thể và cách nhóm chức năng sẽ do Claude Code tự xác định ở Phase 0 dựa trên router config thực tế — prompt này không giả định trước con số hay tên nhóm cố định.

---

## Tiêu chí UI/UX bắt buộc áp dụng

Toàn bộ audit dựa vào **62 tiêu chí** phân theo **7 nhóm** và 3 mức độ ưu tiên:

> **Blocker** = bắt buộc sửa trước khi hoàn thiện
> **Major** = ảnh hưởng UX đáng kể, cần sửa trong cùng sprint
> **Minor** = cải thiện trải nghiệm, sửa nếu còn thời gian

---

### Nhóm 1 — Layout & Navigation

| ID | Mức | Tiêu chí | Ghi chú kiểm tra |
|----|-----|----------|------------------|
| L1 | Blocker | Responsive tốt ở 1280px, 1440px, 1920px | Không collapse sidebar hoặc vỡ table layout |
| L2 | Blocker | Sidebar không che content chính khi collapsed | Main area min 800px khi sidebar thu gọn |
| L3 | Major | Active state rõ ràng trên sidebar | Highlight menu item hiện tại; breadcrumb đồng bộ với route |
| L4 | Major | Sticky header + sidebar khi scroll | Toolbar actions và navigation luôn accessible |
| L5 | Minor | Saved navigation state | Trạng thái expand/collapse sidebar persist sau refresh |
| L6 | Blocker | Không có dead-end page | Mọi trang có đường quay lại hoặc breadcrumb rõ ràng |
| L7 | Major | Menu grouping logic rõ ràng | Các module liên quan được nhóm, tối đa 2 cấp nesting |
| L8 | Minor | Keyboard navigation qua sidebar | Tab/Arrow keys điều hướng được menu items |

---

### Nhóm 2 — Danh sách & Bảng dữ liệu

| ID | Mức | Tiêu chí | Ghi chú kiểm tra |
|----|-----|----------|------------------|
| T1 | Blocker | Skeleton loader khi fetch dữ liệu | Không flash empty state trước khi data về |
| T2 | Blocker | Empty state có hành động gợi ý | Text mô tả + CTA rõ ràng thay vì để trống |
| T3 | Blocker | Phân trang hoặc infinite scroll nhất quán | Không mix hai pattern trong cùng một listing page |
| T4 | Major | Column sort và filter hoạt động độc lập | Sort không reset filter; filter không mất sort state |
| T5 | Major | Bulk action rõ ràng và có confirm step | Select all → action bar → dialog confirm cho destructive action |
| T6 | Major | Sticky header row khi scroll dọc | Column labels visible với table dài |
| T7 | Minor | Column visibility toggle | Admin có thể tuỳ chỉnh cột hiển thị |
| T8 | Major | Search debounce ≥ 300ms | Không fire request mỗi keystroke |
| T9 | Major | Search/filter state persist khi back từ detail | Filter không bị reset khi quay lại listing |
| T10 | Minor | Clear search/filter button rõ ràng | X button hoặc "Reset" link khi có filter active |
| T11 | Major | Dữ liệu con lặp cấu trúc (biến thể, thuộc tính nhiều dòng) nhập bằng bảng ma trận | Không dùng form lặp lại; chọn thuộc tính → tự sinh combination thành dòng, bulk-fill giá trị chung |

---

### Nhóm 3 — Form & Nhập liệu

| ID | Mức | Tiêu chí | Ghi chú kiểm tra |
|----|-----|----------|------------------|
| F1 | Blocker | Inline error message gắn với từng field | Lỗi hiện ngay dưới field vi phạm, không chỉ toast |
| F2 | Blocker | Required fields được đánh dấu rõ | Dấu * + legend, không chỉ dựa vào màu |
| F3 | Major | Validate on-blur, không chỉ on-submit | Admin biết field lỗi ngay khi rời khỏi input |
| F4 | Major | Form không mất data khi submit lỗi | Chỉ highlight lỗi, không clear các field đúng |
| F5 | Blocker | Destructive action cần confirm dialog | Xóa, vô hiệu hóa, publish hàng loạt — luôn có confirm step |
| F6 | Major | Unsaved changes warning khi rời trang | Dialog "Bạn có muốn lưu không?" trước khi navigate away |
| F7 | Major | Loading state trên submit button | Button disable + spinner trong lúc request xử lý |
| F8 | Major | Success feedback sau mỗi action | Toast hoặc inline message xác nhận thao tác thành công |
| F9 | Minor | Auto-save draft cho form dài | Tự động lưu tạm mỗi 30s hoặc khi blur field |
| F10 | Major | Form phức tạp (>8 field) chia section/step | Progressive disclosure — không dồn hết vào 1 màn hình dài |
| F11 | Major | Entity có nhiều field lặp giữa các bản ghi hỗ trợ "Nhân bản" | Copy toàn bộ field từ item có sẵn, chỉ sửa phần khác biệt |
| F12 | Minor | Field suy ra được từ field khác thì auto-derive, cho sửa tay | VD: mô tả ngắn tự trích từ mô tả đầy đủ, slug tự sinh từ tên |
| F13 | Minor | Progress indicator cho form nhiều field/nhiều step | Hiện số mục đã điền hoặc %, không chỉ có nút Submit |

---

### Nhóm 4 — Feedback & Trạng thái hệ thống

| ID | Mức | Tiêu chí | Ghi chú kiểm tra |
|----|-----|----------|------------------|
| N1 | Blocker | Error toast không tự dismiss | Phải có close button, không tự biến mất sau 3s |
| N2 | Blocker | Network error được xử lý gracefully | Timeout, 500, mất kết nối — có thông báo rõ và retry option |
| N3 | Major | Toast không che action buttons | Toast stack ở góc, không overlap với CTA chính |
| N4 | Major | Phân biệt visual: success / warning / error / info | Màu + icon kết hợp, không chỉ dùng màu đơn thuần |
| N5 | Blocker | Không có layout shift khi data load | Reserve không gian trước khi content về, tránh CLS |
| N6 | Major | Progress indicator cho upload / export | File upload lớn và export CSV/Excel cần progress bar |
| N7 | Minor | Optimistic UI cho toggle actions | Toggle phản hồi ngay, rollback nếu API fail |

---

### Nhóm 5 — Accessibility & Performance

| ID | Mức | Tiêu chí | Ghi chú kiểm tra |
|----|-----|----------|------------------|
| A1 | Blocker | Focus visible trên tất cả interactive elements | outline rõ khi Tab, không bị ẩn bởi CSS reset |
| A2 | Blocker | Contrast ratio ≥ 4.5:1 cho text thường | WCAG 2.2 AA — kiểm tra trên cả light và dark mode |
| A3 | Major | Modal focus trap và Escape để đóng | Focus không thoát ra ngoài dialog; Esc đóng modal |
| A4 | Major | Icon buttons có aria-label hoặc tooltip | Icon-only buttons phải có label cho screen reader |
| A5 | Minor | Skip-to-content link cho keyboard users | Link ẩn ở đầu page, hiện khi focus |
| A6 | Major | Route-level code splitting | Không load toàn bộ admin bundle ngay từ đầu |
| A7 | Major | Table virtualization cho list dài | > 500 rows cần virtual scroll |
| A8 | Minor | Debounce resize/scroll event handlers | Listener gắn window cần throttle để tránh jank |

---

### Nhóm 6 — Operational Efficiency (dành riêng cho business user)

| ID | Mức | Tiêu chí | Ghi chú kiểm tra |
|----|-----|----------|------------------|
| O1 | Blocker | Số click tối thiểu để hoàn thành tác vụ thường gặp | Tạo đơn hàng, duyệt sản phẩm, đổi trạng thái — không quá 3 click |
| O2 | Blocker | Action phổ biến nhất luôn nằm trên màn hình đầu tiên | Không phải scroll hoặc mở menu phụ mới thấy |
| O3 | Major | Keyboard shortcut cho tác vụ lặp lại | Ít nhất: Save (Ctrl+S), Search (Ctrl+K hoặc /), Confirm dialog (Enter) |
| O4 | Major | Inline edit trực tiếp trên table row | Đổi trạng thái, giá, tồn kho — không cần vào trang detail |
| O5 | Major | Quick filter preset cho các view thường dùng | Ví dụ: "Đơn chờ xử lý", "Sản phẩm hết hàng", "Bài viết chưa duyệt" — 1 click |
| O6 | Major | Action hàng loạt (bulk) cho tác vụ lặp | Duyệt / từ chối / xóa nhiều item cùng lúc |
| O7 | Major | Dashboard overview phản ánh đúng công việc hàng ngày | Widget ưu tiên theo vai trò, không hiển thị số liệu không liên quan |
| O8 | Minor | Global search xuyên suốt toàn bộ module | Tìm đơn hàng, sản phẩm, khách hàng từ một ô search duy nhất (Ctrl+K) |
| O9 | Minor | Recent items / lịch sử truy cập nhanh | Danh sách 5–10 items vừa xem gần đây |
| O10 | Minor | Thông tin dense — không padding quá lớn | Admin cần thấy nhiều data trên một màn hình, tránh whitespace lãng phí |

---

### Nhóm 7 — Visual Hierarchy & Consistency

| ID | Mức | Tiêu chí | Ghi chú kiểm tra |
|----|-----|----------|------------------|
| V1 | Major | Mỗi màn hình có 1 điểm nhấn chính, nhận diện được trong vài giây đầu | Heading/trạng thái/action chính nổi bật rõ bằng size/màu/vị trí — không nhiều yếu tố cạnh tranh cùng độ nổi bật |
| V2 | Major | Spacing (padding/margin/gap) theo hệ số nhất quán toàn hệ thống | Dùng bội số cố định 4px hoặc 8px, không theo giá trị tuỳ cảm tính |
| V3 | Major | Card/khối cùng cấp căn chỉnh thẳng hàng theo lưới chung | Cùng chiều rộng, cùng điểm bắt đầu — không lệch hàng ngang/dọc giữa các card |
| V4 | Minor | Nhóm thông tin liên quan gần nhau, tách nhóm không liên quan bằng khoảng trắng | Khoảng cách trong nhóm nhỏ hơn khoảng cách giữa các nhóm — giúp mắt nhận nhóm ngay không cần đọc |
| V5 | Minor | Label/text dùng ngôn ngữ đơn giản, nhất quán toàn hệ thống | Tránh thuật ngữ kỹ thuật không cần thiết; cùng khái niệm dùng cùng một từ xuyên suốt các module |

---

## Workflow bắt buộc: Audit → Confirm → Fix

### PHASE 0 — Discovery (KHÔNG sửa code)

**Mục tiêu:** Lập inventory đầy đủ, không bỏ sót bất kỳ trang hay component nào.

Thực hiện tuần tự:

1. Đọc entry point chính (thường `src/main.jsx` — dự án dùng JavaScript, không phải `.tsx`) và file cấu hình router (`App.jsx` hoặc file router tách riêng nếu có). Nếu tên/đuôi file thực tế khác, tự điều chỉnh theo đúng cấu trúc dự án.
2. Trích xuất **toàn bộ routes**: mọi `<Route>`, `lazy()`, `React.lazy` → map `route path ↔ page component file`.
3. Liệt kê cấu trúc thư mục `src/` thực tế trước (không giả định tên thư mục), sau đó glob toàn bộ file trong các thư mục chứa page/component xác định được — ví dụ có thể là `pages`, `features`, `modules`, `layouts`, `components`, `ui`, `shared`, hoặc tên khác tuỳ dự án thực tế đặt.
4. Cross-check: file nào không xuất hiện trong route config nhưng tồn tại trong glob → đánh dấu `[orphan?]` để kiểm tra thủ công.
5. Tổng hợp thành **bảng coverage**: mỗi dòng = 1 page/component, cột gồm `route ↔ file path ↔ nhóm chức năng (xác định theo cấu trúc route/permission thực tế của dự án, không theo danh sách dựng sẵn) ↔ trạng thái audit`, mặc định `[chưa kiểm]`. Báo cáo tổng số file và tổng số nhóm chức năng phát hiện được.

---

### PHASE 1 — Audit (KHÔNG sửa code)

**Mục tiêu:** Đối chiếu từng item trong bảng coverage với đầy đủ **62 tiêu chí (7 nhóm)**.

1. Với mỗi page/component, kiểm tra lần lượt các nhóm tiêu chí áp dụng được (L, T, F, N, A, O, V).
2. Mỗi phát hiện vi phạm ghi theo format: `[ID tiêu chí] | file:dòng | mức độ | mô tả | đề xuất sửa`.
3. Đánh dấu **Patterns lặp lại** — vi phạm cùng loại xuất hiện ở ≥ 3 module → ưu tiên tạo shared component thay vì fix lẻ từng nơi.
4. Xuất báo cáo `UIUX_AUDIT_REPORT.md`: tổng số tiêu chí áp dụng, số lượng Blocker/Major/Minor, chi tiết theo module, danh sách patterns lặp lại.
5. Cập nhật trạng thái audit trong bảng coverage — không được để sót item `[chưa kiểm]`.

---

**CHECKPOINT — dừng lại tại đây.**

Trình bày tóm tắt: tổng số vi phạm theo từng mức độ, top patterns lặp lại, danh sách shared component đề xuất tạo mới. **Chờ xác nhận trước khi chuyển sang Phase 2.**

---

### PHASE 2 — Fix & Redesign (chỉ thực hiện sau khi đã xác nhận ở checkpoint)

Sửa theo thứ tự ưu tiên: **Blocker → Major → Minor**.

- Được phép **redesign** giao diện khi vi phạm nghiêm trọng hoặc bố cục bất hợp lý — với điều kiện giữ nhất quán design system, không đổi API contract, không phá chức năng.
- Vi phạm lặp ở nhiều module → **tạo/đồng bộ shared component** thay vì sửa lẻ.
- Sau mỗi nhóm fix, re-test đúng các tiêu chí đã fail; xác nhận không gây regression ở module liên quan.
- Cập nhật `UIUX_AUDIT_REPORT.md`: trạng thái mỗi item → `Fixed` / `Redesigned` / `Deferred (lý do)`.

**Tiêu chí hoàn thành Phase 2:**

- 0 Blocker tồn đọng.
- Major < 10% tổng số tiêu chí áp dụng.
- Tất cả tiêu chí A1–A4 (WCAG AA) pass.
- Mọi item trong inventory đều có trạng thái audit — không còn `[chưa kiểm]`.

---

## Lưu ý triển khai

- **Vite-specific**: xử lý `vite:preloadError` tại error boundary cấp route; dùng `React.lazy` + `Suspense` với skeleton fallback cho từng nhóm chức năng.
- **Search & filter state**: ưu tiên lưu vào URL search params (`useSearchParams`) thay vì local state để persist khi back/forward.
- **Shared components ưu tiên tạo** (đổi tên nếu dự án đã có convention khác): `<SkeletonTable>`, `<EmptyState>`, `<ConfirmDialog>`, `<FormErrorMessage>`, `<ToastProvider>`, `<ProgressUpload>`.
- **Không chỉnh sửa** business logic, API calls, state management ngoài phạm vi UI/UX.

> **Tùy chọn điều chỉnh:** Prompt này giữ checkpoint Audit → Confirm → Fix (an toàn cho dự án thực). Nếu muốn Claude Code redesign ngay trong một lần chạy không cần xác nhận, bỏ phần **CHECKPOINT** và gộp Phase 2 vào ngay sau Phase 1.
