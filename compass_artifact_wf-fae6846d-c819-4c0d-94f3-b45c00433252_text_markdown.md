# Checklist Tiêu chí UI/UX khi Admin vào Dashboard — bigbike-admin (Vite + React)

**Phạm vi:** Bộ tiêu chí dưới đây là checklist audit giao diện & trải nghiệm dành cho admin khi đăng nhập và sử dụng dashboard. KHÔNG bao gồm tiêu chí bảo mật đăng nhập (auth/MFA) hay phân quyền (role/permission). Tổng hợp từ best practices ngành (Nielsen Norman Group, WCAG 2.2, Material/Carbon/USWDS design systems, react.dev, Vite & React Router docs) và tinh chỉnh cho dự án Vite + React, 21 modules / 5 nhóm chức năng. Áp dụng trực tiếp cho khung audit 2-phase (Audit → Fix với checkpoint) hiện có.

> *Lưu ý nguồn:* Không tìm thấy tài liệu framework audit gốc trong Google Drive (Drive chỉ chứa nội dung marketing sản phẩm BigBike); checklist này được dựng lại từ chuẩn ngành để khớp với mô tả dự án.

---

## TL;DR
- **13 nhóm tiêu chí UI/UX** cần kiểm khi admin vào dashboard: Login → Layout/Navigation → IA (21 modules/5 nhóm) → Visual consistency → Responsive → Data table → Form → Feedback/trạng thái → Overview page → Accessibility → Perceived performance → Client-side routing → Onboarding. Mỗi nhóm có các gạch đầu dòng dùng trực tiếp làm mục audit.
- **Trọng tâm cho e-commerce admin:** Data table UX (sort/filter/pagination/bulk action/empty & loading state) và Form UX (validation inline + confirm dialog cho hành động phá hủy) là hai nhóm có tác động lớn nhất tới hiệu suất công việc admin — ưu tiên audit trước.
- **Đặc thù Vite + React (đừng bỏ sót):** Error boundary theo từng vùng để 1 module lỗi không làm trắng cả app; route-level code splitting (React.lazy + Suspense) với skeleton fallback; xử lý lỗi chunk cũ sau deploy (`vite:preloadError` → reload có chống lặp); scroll restoration + active NavLink khi điều hướng.

---

## Key Findings
- Bộ tiêu chí được chia làm hai lớp: **lớp UX phổ quát** (login, navigation, IA, table, form, feedback, overview, a11y, onboarding) áp dụng cho mọi admin panel, và **lớp kỹ thuật đặc thù Vite + React SPA** (error boundary, code splitting, perceived performance, client-side routing) thường bị bỏ qua nhưng quyết định cảm nhận "mượt/ổn định" của dashboard.
- Nhiều ngưỡng kỹ thuật nên neo vào **chuẩn định danh** thay vì cảm tính: WCAG 2.2 cho a11y (contrast, focus, target size), Apple HIG cho tap target, NN/g cho breadcrumb/form error.
- Một số con số là **quy ước best-practice nội bộ** (toast 4–5s, pagination 25–50 dòng, ngưỡng 1000 dòng client-side) — giữ lại như mặc định khuyến nghị, có thể điều chỉnh theo dữ liệu thực tế của dự án.

---

## Details — Checklist theo nhóm

### 1. Trang đăng nhập (Login Page UX)
- [ ] Bố cục tối giản, một cột, form căn giữa; auto-focus ô đầu tiên (email/username); không nhiễu thị giác.
- [ ] Hiển thị lỗi tức thì sau khi submit; **KHÔNG xóa dữ liệu đã nhập**, giữ nguyên email để admin chỉ cần nhập lại mật khẩu (NN/g).
- [ ] Thông báo lỗi inline, rõ ràng, có hướng dẫn ("Email hoặc mật khẩu không đúng"); không chỉ dựa vào màu — kèm icon + text.
- [ ] Trạng thái loading rõ ràng trên nút submit (spinner / disabled) để admin biết hệ thống đang xử lý, tránh double-submit.
- [ ] Link "Quên mật khẩu?" đặt ngay dưới ô mật khẩu, dễ thấy.
- [ ] Cho phép paste mật khẩu, toggle ẩn/hiện mật khẩu, tương thích password manager.
- [ ] Responsive desktop & tablet; tap target đạt **≥ 44×44 px** theo Apple Human Interface Guidelines ("Create controls that measure at least 44 points x 44 points so they can be accurately tapped with a finger") — tương đương WCAG 2.5.5 Target Size (Enhanced, AAA); mức tối thiểu WCAG 2.5.8 (AA) là 24×24 CSS px.
- [ ] Sau đăng nhập thành công: chuyển tiếp nhanh, có chỉ báo ("Đang chuyển hướng…"); nếu còn session hợp lệ thì bỏ qua màn login.

### 2. Layout & Navigation tổng thể
- [ ] Sidebar điều hướng dọc (vertical nav) cố định — phù hợp hệ thống nhiều mục như 21 modules; trạng thái active rõ ràng.
- [ ] Header sticky chứa yếu tố toàn cục: logo/tên, tìm kiếm, thông báo, menu tài khoản.
- [ ] Breadcrumb đặt ngay dưới header / trên tiêu đề trang; phản ánh đúng cấu trúc thông tin (location-based, không phải lịch sử duyệt) (NN/g).
- [ ] Mỗi node breadcrumb (trừ trang hiện tại) là link click được; trang hiện tại là text không link.
- [ ] Highlight rõ module đang mở trong sidebar để admin luôn biết "đang ở đâu".
- [ ] Điều hướng giữa các module nhất quán; không bắt admin học lại cách dùng ở mỗi trang.
- [ ] Sidebar collapse được để mở rộng vùng nội dung; tối thiểu cấp menu lồng nhau.
- [ ] Có tìm kiếm nhanh để truy cập module/bản ghi mà không cần click nhiều cấp.

### 3. Information Architecture (tổ chức 21 modules / 5 nhóm)
- [ ] 21 modules được nhóm logic thành 5 nhóm chức năng có nhãn rõ ràng trong sidebar; nhãn dùng từ ngữ nghiệp vụ quen thuộc, không viết tắt khó hiểu.
- [ ] Nhóm và thứ tự module phản ánh tần suất sử dụng & quy trình công việc thực tế của admin.
- [ ] Cấu trúc phân cấp không quá sâu (lý tưởng ≤ 3 cấp); breadcrumb quá dài là dấu hiệu IA cần làm phẳng.
- [ ] Nhãn nhóm/module nhất quán giữa sidebar, breadcrumb và tiêu đề trang (cùng cách gọi).
- [ ] Các module cùng nghiệp vụ sản phẩm (mũ bảo hiểm, găng tay, áo giáp, giày, quần bảo hộ) đặt gần nhau, dễ tìm.

### 4. Tính nhất quán Visual (Design System)
- [ ] Dùng **design tokens** cho màu, typography, spacing để nhất quán toàn hệ thống.
- [ ] Bảng màu thống nhất: một màu cho cùng loại phần tử; màu semantic (success/warning/error/info) nhất quán.
- [ ] Typography có thang bậc rõ (heading/body), font & cỡ chữ đồng nhất, luôn dễ đọc.
- [ ] Spacing dùng thang đo nhất quán (spacing token); whitespace tách biệt các khối.
- [ ] Tái sử dụng component (button, input, card, table, modal…) thay vì biến thể tùy tiện mỗi trang.
- [ ] Pattern tương tác (filter, drill-down, chuyển view) hành xử nhất quán xuyên suốt.
- [ ] Dùng card UI để nhóm nội dung liên quan; tránh nhồi nhét, giới hạn số phần tử hiển thị cùng lúc.

### 5. Responsive / Breakpoint behavior
- [ ] Hỗ trợ tốt desktop (≥1200px, lưới 12 cột) và tablet (768–1024px).
- [ ] Sidebar tự collapse thành hamburger/drawer ở breakpoint nhỏ (thường <768px); nội dung vẫn truy cập được.
- [ ] Bảng dữ liệu chuyển layout phù hợp ở tablet (cuộn ngang có cột cố định / stacking) thay vì vỡ layout.
- [ ] Layout dùng lưới linh hoạt (flexbox/grid); kiểm tránh vỡ ở khoảng 600–900px (vùng hay bị bỏ sót).
- [ ] Tap target ≥ 44×44px cho thao tác chạm trên tablet; kiểm thử ở 1px dưới / tại / trên mỗi breakpoint.

### 6. Data Table / List View UX *(quan trọng nhất cho e-commerce admin)*
- [ ] Sort theo cột, có một sort mặc định hợp lý; chỉ báo sort (chevron) không phá vỡ căn lề cột.
- [ ] Filter đặt đầu bảng, gần cột liên quan; hiển thị **filter chips** để admin biết đang lọc gì.
- [ ] Pagination có "rows per page" (mặc định khuyến nghị 25–50) và tổng số bản ghi; tránh "load more"/infinite scroll cho bảng phân tích.
- [ ] Bulk actions: checkbox chọn nhiều dòng, dòng đã chọn đổi màu nền; thanh bulk-action xuất hiện gần bảng và bám theo khi cuộn; nêu rõ "Chọn tất cả N kết quả khớp" khi áp dụng toàn tập.
- [ ] Empty state hữu ích khi không có dữ liệu / không khớp filter: nêu lý do + hành động ("Xóa filter", "Thêm mới", "Thử từ khóa khác").
- [ ] Loading state: skeleton loader mô phỏng cấu trúc bảng thay vì màn hình trống.
- [ ] Status badge có màu (active/inactive/pending) để quét nhanh; căn lề text trái, số/ngày phải.
- [ ] Sticky header (và control panel) khi cuộn bảng dài; row actions hiện khi hover.
- [ ] Quyết định client-side vs server-side sort/filter theo khối lượng (quy ước: ≤1000 dòng → client-side; lớn hơn → server-side).

### 7. Form UX
- [ ] Validation inline: hiện lỗi cạnh field sau khi rời field, theo nguyên tắc "reward early, punish late"; không xóa dữ liệu đã nhập.
- [ ] Thông báo lỗi explicit, dễ hiểu, có gợi ý sửa + ví dụ input đúng; đặt sát field, không chỉ banner đầu trang (NN/g).
- [ ] Lỗi không chỉ dựa vào màu: kèm icon + viền + text; đỏ cho lỗi, xanh/check cho hợp lệ.
- [ ] Trạng thái submit rõ ràng: nút loading/disabled khi đang lưu; phản hồi success/fail sau submit.
- [ ] Confirm dialog cho hành động phá hủy (xóa sản phẩm/đơn): nêu rõ hậu quả; nút thể hiện đúng hành động ("Xóa"), tránh Yes/No mơ hồ (Carbon/NN/g).
- [ ] Hành động không thể hoàn tác: yêu cầu gõ xác nhận hoặc cung cấp Undo; tránh lạm dụng confirm cho thao tác thường.
- [ ] Validate trước khi đóng modal; nếu lỗi server thì hiện inline notification, modal vẫn mở.
- [ ] Dùng selection controls (dropdown, bound input) để giảm sai sót; field bắt buộc/định dạng đặc biệt nêu rõ trong label.

### 8. Feedback & Trạng thái hệ thống
- [ ] Toast/notification: ngắn gọn, màu semantic; toast thành công/non-critical tự ẩn (quy ước ~4–5s), toast có action hoặc critical thì không tự ẩn (chờ admin dismiss).
- [ ] Chỉ hiện một toast tại một thời điểm (tối đa 2–3 stack); không lạm dụng đến mức như luồng thông báo vô tận.
- [ ] Loading skeleton cho tải trang/khối dữ liệu; spinner trên nút cho hành động người dùng kích hoạt.
- [ ] Optimistic UI cho thao tác nhanh: cập nhật UI ngay, rollback nếu lỗi.
- [ ] **Error boundary cho từng vùng độc lập** (sidebar, vùng nội dung, từng widget). React docs cảnh báo: *"As of React 16, errors that were not caught by any error boundary will result in unmounting of the whole React component tree"* — vì vậy đặt boundary cấp vùng để một module lỗi không làm trắng cả dashboard (mô hình Facebook Messenger wrap sidebar/panel/log riêng).
- [ ] Boundary dùng cả `getDerivedStateFromError` (render fallback) và `componentDidCatch` (log lỗi về analytics/Sentry). Lưu ý boundary KHÔNG bắt lỗi trong event handler, async/`setTimeout`, hay SSR.
- [ ] Fallback UI khi lỗi: thông báo thân thiện (không stack trace), nút "Thử lại"/reload, `role="alert"`; chi tiết lỗi chỉ hiện ở môi trường dev.
- [ ] Mọi hành động admin đều có phản hồi (loading → success/error); không để admin "đoán" hệ thống có nhận lệnh không.

### 9. Dashboard / Overview Page
- [ ] KPI/số liệu quan trọng nhất đặt trên cùng / góc trái (F-pattern, "above the fold"); admin nắm tình hình trong ~5 giây.
- [ ] Mỗi số liệu có context (so sánh kỳ trước / mục tiêu), nhãn rõ kèm đơn vị (₫, %, đơn hàng) và khoảng thời gian/timestamp.
- [ ] Quick actions cho tác vụ thường dùng (thêm sản phẩm, xử lý đơn) đặt dễ thấy.
- [ ] Widget dạng card, nhóm theo nghĩa; giới hạn số widget để tránh quá tải nhận thức.
- [ ] Badge/icon/banner cho cảnh báo cần hành động (tồn kho thấp, đơn chờ xử lý); không lạm dụng đỏ cho mục không khẩn.
- [ ] Chart phù hợp loại dữ liệu, phẳng & rõ, có tiêu đề; tránh pie nhiều lát, dual-axis, hiệu ứng 3D.
- [ ] Tooltip/info icon giải thích metric khó hiểu mà không rời dashboard.

### 10. Accessibility (a11y) cơ bản — neo theo WCAG 2.2
- [ ] Điều hướng đầy đủ bằng bàn phím; không có "keyboard trap"; thứ tự tab hợp lý theo bố cục.
- [ ] **Focus indicator rõ ràng.** Mục tiêu tối thiểu WCAG 2.2 SC 2.4.7 Focus Visible (đã nâng lên **Level A** ở 2.2). Nếu hướng tới Focus Appearance: SC 2.4.11 (AA) / SC 2.4.13 (AAA) yêu cầu *"an area of the focus indicator… is at least as large as the area of a 2 CSS pixel thick perimeter of the unfocused component… has a contrast ratio of at least 3:1 between the same pixels in the focused and unfocused states."* Dùng `:focus-visible`, tránh `outline:none` nếu không có thay thế.
- [ ] Focus không bị che bởi header/footer sticky (SC 2.4.11 Focus Not Obscured).
- [ ] **Độ tương phản text** theo SC 1.4.3 Contrast (Minimum, AA): *"contrast ratio of at least 4.5:1"* cho text thường; large text (≥18pt, hoặc ≥14pt bold ≈ 24px/18.5px) chỉ cần **3:1**. Không dùng màu đơn lẻ để truyền đạt trạng thái.
- [ ] HTML ngữ nghĩa cho bảng (`table/thead/tbody`, `scope`), ARIA label cho control; thông báo thay đổi (sort/filter) cho screen reader qua ARIA live region.
- [ ] Breadcrumb dùng `nav` + `ol/li`, `aria-label="Breadcrumb"`, `aria-current="page"` cho trang hiện tại; separator ẩn với screen reader (USWDS).
- [ ] Trang dùng được khi zoom 200%; text resize tới 200% không cần công nghệ hỗ trợ.
- [ ] Hành động kéo-thả (nếu có, ví dụ sắp xếp cột) phải có thay thế single-pointer/bàn phím (SC 2.5.7 Dragging Movements).

### 11. Perceived Performance (cảm nhận hiệu năng) — đặc thù Vite SPA
- [ ] **Skeleton screen** thay cho màn trắng/spinner đơn thuần khi tải. Nghiên cứu (Viget 2017; Mejtoft, Långström & Söderström, ECCE '18) cho thấy trang dùng skeleton được đánh giá tốc độ tải cảm nhận cao hơn (~20%) — *tuy nhiên kết quả còn tranh luận* (cùng Viget có thử nghiệm cho kết quả trái chiều), nên xem là ước lượng, không phải con số tuyệt đối.
- [ ] **Route-level code splitting** bằng `React.lazy` + `Suspense`: mỗi module là một chunk riêng, chỉ tải chunk của trang đang vào (react.dev khuyến nghị split theo route: *"A good place to start is with routes"*).
- [ ] Suspense `fallback` là skeleton khớp layout (đặt sẵn chỗ cho bảng/card) để tránh layout shift — react.dev: *"a fallback is a lightweight placeholder view, such as a loading spinner or skeleton."*
- [ ] Xử lý màn hình trắng ban đầu của Vite SPA: chèn placeholder loading inline trong `#root` trước khi React render.
- [ ] Phản hồi chuyển trang: top-bar progress / NavLink pending state / `useTransition` `isPending` để admin biết đang điều hướng.
- [ ] **Xử lý lỗi chunk cũ sau deploy mới** (lỗi "Failed to fetch dynamically imported module"): lắng nghe `vite:preloadError` → reload trang. Vite docs: *"Implement error handling for dynamic imports to reload the page when chunks are missing… you cannot retry the dynamic import."* Thêm cơ chế chống reload lặp vô hạn (đếm retry qua `sessionStorage`).
- [ ] Tối ưu tải: lazy loading bảng dữ liệu lớn, caching/prefetch; tránh widget high-latency/live video làm chậm tổng thể.

### 12. Client-side Routing UX (React Router)
- [ ] Scroll restoration khi đổi route (`<ScrollRestoration>` ở root route, hoặc `useLayoutEffect` ScrollToTop); back/forward khôi phục vị trí cuộn trước đó. React Router docs: *"This component will emulate the browser's scroll restoration on location changes."*
- [ ] Active nav highlighting bằng `<NavLink>` — *"Automatically applies `aria-current=\"page\"` to the link when the link is active"*; dùng prop `end` cho link trang chủ để không bị active ở mọi route.
- [ ] Browser back/forward hoạt động đúng (không phá vỡ history); quản lý/di chuyển focus khi đổi route cho người dùng bàn phím/screen reader.
- [ ] Lưu ý scroll-flashing ở lần tải đầu của Vite CSR (không SSR) — cân nhắc `behavior: 'instant'` để tránh giật.

### 13. Onboarding / First-time Experience
- [ ] Không để admin lần đầu đối mặt dashboard trống/đầy số 0; dùng empty state có hướng dẫn + CTA rõ.
- [ ] Empty state mỗi module theo nguyên tắc "hai phần hướng dẫn, một phần delight" — nêu module dùng để làm gì + nút hành động đầu tiên.
- [ ] Checklist khởi đầu ngắn (3–5 mục, gắn với giá trị thực) giúp admin hoàn tất thiết lập ban đầu.
- [ ] Onboarding ngắn gọn, có thể bỏ qua (skip); progressive disclosure để tránh quá tải thông tin.
- [ ] Tooltip/microcopy theo ngữ cảnh ngay trong UI thay vì tài liệu rời; không dùng dữ liệu giả gây hiểu lầm.
- [ ] Hướng dẫn in-context tại nơi cần, nhằm đưa admin đến "first value moment" nhanh nhất.

---

## Recommendations — Áp dụng vào khung Audit 2-phase

**Giai đoạn chuẩn bị (trước Audit):**
- Chuyển 13 nhóm trên thành bảng audit (cột: tiêu chí / module áp dụng / mức nghiêm trọng / screenshot / ghi chú). Gắn ID tiêu chí (vd. `6.3` = pagination) để dễ tham chiếu khi fix.
- Chốt các ngưỡng quy ước cho dự án trước khi audit: rows-per-page mặc định, thời lượng toast, ngưỡng client/server-side, breakpoint chính thức (desktop/tablet). Ghi vào tài liệu để tránh tranh cãi khi chấm.

**Phase 1 — Audit (theo thứ tự ưu tiên tác động):**
1. Audit trước nhóm **6 (Data Table)** và **7 (Form)** trên cả 21 modules — đây là nơi admin thao tác nhiều nhất, lỗi ở đây tốn thời gian vận hành nhất.
2. Tiếp đến nhóm **8 (Feedback/Error boundary)** và **11–12 (Performance/Routing)** — các lỗi "trắng màn hình", chunk cũ sau deploy, mất scroll thường là blocker nhưng dễ bị bỏ sót.
3. Sau đó nhóm **2–5** (Navigation/IA/Visual/Responsive) và **1, 9, 10, 13**.
- Phân mức: **Blocker** (chặn tác vụ / trắng màn / mất dữ liệu) → **Major** (gây nhầm lẫn, chậm việc) → **Minor** (thẩm mỹ, nhất quán). Mỗi phát hiện kèm screenshot + tiêu chí ID.

**Checkpoint:**
- Tổng hợp số vi phạm theo nhóm & mức; thống nhất danh mục fix Phase 2. **Tiêu chí chuyển giai đoạn:** xử lý 100% Blocker trước khi đụng Minor.

**Phase 2 — Fix & Re-test:**
- Sửa theo thứ tự Blocker → Major → Minor; re-test lại đúng tiêu chí ID đã fail; xác nhận không hồi quy UI/UX ở module liên quan.
- **Ngưỡng "đạt" đề xuất:** 0 Blocker tồn đọng, Major < 10% số tiêu chí áp dụng, các tiêu chí a11y WCAG mức A/AA pass toàn bộ.

**Benchmark khiến nên thay đổi hành động:**
- Nếu >30% module fail cùng một tiêu chí (vd. thiếu empty state, thiếu skeleton) → không fix lẻ, mà **chuẩn hóa thành component dùng chung** trong design system rồi thay thế đồng loạt.
- Nếu lỗi tập trung ở routing/chunk → ưu tiên dựng **global error boundary + `vite:preloadError` handler** cấp app trước khi audit tiếp các module.

---

## Caveats
- **Không có tài liệu gốc:** Framework audit 2-phase và mô tả 21 modules/5 nhóm của bigbike-admin không tìm thấy trong Google Drive (chỉ có nội dung marketing BigBike). Checklist dựng từ chuẩn ngành; cần đối chiếu lại với tài liệu nội bộ của Anh Đức để khớp tên module/nhóm cụ thể.
- **Ngưỡng số là quy ước:** Một số con số (toast 4–5s, pagination 25–50, ngưỡng 1000 dòng, skeleton chỉ hữu ích khi load >500ms) là best-practice phổ biến chứ không có chuẩn định danh tuyệt đối — điều chỉnh theo dữ liệu thực tế và kết quả user testing.
- **Con số perceived performance còn tranh luận:** "~20% nhanh hơn" của skeleton screen đến từ Viget/Mejtoft et al. nhưng có nghiên cứu cho kết quả trái chiều; dùng làm định hướng, không phải bằng chứng tuyệt đối.
- **WCAG: phân biệt mức.** Tap target 44×44 và Focus Appearance chi tiết là mức **AAA**; mức bắt buộc thực dụng cho hầu hết dự án là **AA** (target tối thiểu 24×24, contrast text 4.5:1, focus visible đã là Level A). Chọn mức mục tiêu (AA hay AAA) trước khi audit để chấm nhất quán.
- **Tài liệu Error Boundary / Code-Splitting** một phần nằm trên trang React docs cũ (legacy.reactjs.org); nội dung tương đương đã có trên react.dev và đã được đối chiếu khớp. Cơ chế chống reload lặp cho `vite:preloadError` là best-practice cộng đồng (không nằm trong Vite docs chính thức).