# DASHBOARD_REPORTS_AUDIT — module Tổng quan & Báo cáo (bigbike-admin)

> Audit production-readiness của 2 màn hình admin: **Tổng quan** (`/admin/dashboard`) và **Báo cáo** (`/admin/reports`). Ngày audit: **2026-07-04**.
>
> Phương pháp: đọc docs nghiệp vụ (`MODULE_CATALOG.md`, `API_CONTRACT.md`, `DATA_CONTRACT.md`, `PERMISSION_MATRIX.md`, `USER_ROLES.md`) + các audit trước liên quan (`UIUX_AUDIT_REPORT_bigbike-admin.md`, `REALTIME_DATA_FETCHING_AUDIT_2026-06-11.md`, `FE_BE_CONTRACT_VERIFICATION_REPORT_2026-06-11.md`) → đối chiếu code frontend (`bigbike-admin`) + backend (Spring Boot) → xác minh trực tiếp trên database `bigbike-postgres` đang chạy (phân bổ trạng thái đơn thật, quyền theo vai trò thật qua bảng `role_permissions`) → 3 lượt rà soát độc lập (FE Tổng quan / FE Báo cáo / Backend).
>
> *Báo cáo READ-ONLY — không file code nào bị sửa trong quá trình audit.*

## Kết luận

**Có thể vận hành — không có lỗi chặn production (0 BLOCKER, 0 HIGH).** Cả 2 module đọc đúng dữ liệu thật (không hardcode/mock), công thức tính tiền/tăng trưởng/chia theo trạng thái đúng và đã đối chiếu với dữ liệu thật. Phân quyền (`orders.read`, `reports.read`, `reports.export`) đã xác minh chặt chẽ qua database thật: chỉ `ADMIN`/`SHOP_MANAGER`/`SUPER_ADMIN` thấy được doanh thu, `EDITOR` không có quyền nào trong 3 quyền này — không rò rỉ dữ liệu ngoài phạm vi quyền.

Còn **13 điểm mức MEDIUM** và **20 điểm mức LOW** — chủ yếu là trạng thái hiển thị chưa mượt ở tình huống hiếm gặp, 1 lỗi bộ lọc ngày, và khoảng trống tài liệu kỹ thuật.

| Mức độ | Số lượng |
|---|---|
| 🔴 BLOCKER | 0 |
| 🟠 HIGH | 0 |
| 🟡 MEDIUM | 13 |
| ⚪ LOW | 20 |
| ✅ Đã xác nhận tốt | 18 |

### Ưu tiên xử lý (6 việc hiệu quả cao nhất)

1. **Sửa 3 bài test tự động còn tạo đơn "Đã hoàn tiền" (REFUNDED)** — trạng thái đã khai tử từ 23/06, DB thật đã sạch, nhưng test lỗi thời làm mất tác dụng cảnh báo của bộ kiểm tra doanh thu. Xem §Chung #1.
2. **Sửa lỗi bộ lọc ngày tùy chỉnh ở Báo cáo** khi chỉ điền 1 trong 2 ô — có thể hiện "0 đơn" sai. Xem §Báo cáo MEDIUM #1–#2.
3. **Đổi màu slice "Thất bại"** trong biểu đồ tròn trạng thái đơn ở Tổng quan — đang trùng màu "Đã hủy". Xem §Tổng quan MEDIUM #2.
4. **Thay thông báo lỗi mạng thô bằng tiếng Việt dễ hiểu** ở Báo cáo. Xem §Báo cáo MEDIUM #3.
5. **Thêm thông báo "Chưa đủ dữ liệu"** khi biểu đồ doanh thu theo ngày chỉ có 0–1 điểm. Xem §Báo cáo MEDIUM #4.
6. **Bổ sung tài liệu kỹ thuật còn thiếu** (`DATA_CONTRACT.md`, `API_CONTRACT.md`) cho các field/endpoint đã có trong code. Xem §Chung #2–#4.

---

## Module Tổng quan (Dashboard)

File chính: `bigbike-admin/src/screens/DashboardScreen.jsx`, `.../screens/dashboard/charts.jsx` · API: `GET /api/v1/admin/dashboard?period={7d|30d|90d}` · quyền `orders.read` (roles `ADMIN`/`SUPER_ADMIN`/`SHOP_MANAGER`).

### MEDIUM

- **Ô cảnh báo "Hết hàng" khi lỗi tải bị thiếu tiêu đề, để trống một dòng heading rỗng.** Khi API tồn kho lỗi, khối cảnh báo hiện đúng mô tả nhưng không truyền `title` cho `StatePanel` — component render `<h2>` không điều kiện nên để lại heading rỗng trong DOM, gây nhiễu cho phần mềm đọc màn hình.
  - `DashboardScreen.jsx:427-431`, `components/StatePanel.jsx:34`
  - Đề xuất: truyền `title` mặc định, hoặc sửa `StatePanel` chỉ render `<h2>` khi có nội dung.

- **Biểu đồ tròn trạng thái đơn: "Đã hủy" và "Thất bại" dùng chung một màu.** Trong kỳ có cả 2 loại đơn, 2 lát cắt sẽ cùng màu tuyệt đối (cả sáng lẫn tối) — chỉ phân biệt được nhờ đọc kỹ chú thích, không nhìn được ngay trên biểu đồ.
  - `DashboardScreen.jsx:28-35` (`ORDER_STATUS_COLORS`)
  - Đề xuất: gán cho "Thất bại" một tông màu riêng thay vì dùng chung token với "Đã hủy".

### LOW

- **Tỷ lệ tăng trưởng doanh thu không giới hạn trần** khi tăng đột biến (vd "Tăng 499.900%") — không sai về toán học nhưng phi thực tế. `DashboardScreen.jsx:154-160`. Đề xuất: cap hiển thị dạng "&gt;999%".
- **Lời chào có thể lửng** ("Chào buổi sáng,  👋") nếu tài khoản admin chưa có họ tên. `DashboardScreen.jsx:96-97`. Đề xuất: câu chào dự phòng không kèm tên.
- **Nhánh xử lý "chưa có dữ liệu" cho tiền đã thu không bao giờ chạy tới** — backend luôn trả 0 chứ không trả rỗng. `DashboardScreen.jsx:282-284`. Dọn khi có dịp refactor.
- **Bảng "Đơn hàng gần nhất" không hiện thời điểm đặt hàng** dù backend đã trả sẵn field này. Đề xuất: thêm nhãn thời gian tương đối.
- **Nút "Thêm sản phẩm" ở ô trống Top bán chạy dẫn tới trang danh sách**, không phải trang tạo mới. `DashboardScreen.jsx:626`. Đề xuất: trỏ thẳng route tạo sản phẩm.
- **11 nhãn dùng `defaultValue` hardcode chưa có trong file ngôn ngữ** (vi.json/en.json) + **9 khoá dịch cũ không còn dùng** (rác dịch thuật). Không gấp, dọn theo đợt rà soát i18n toàn dự án.
- **Top 5 sản phẩm bán chạy không có tiêu chí phụ khi trùng doanh thu** — thứ tự có thể đảo lộn ngẫu nhiên giữa các lần tải. `OrderLineItemJpaRepository.java` (`topProductsByRevenueSinceExcluding`). Đề xuất: thêm tiêu chí phụ ổn định.
- **Thiếu vài kịch bản test quan trọng**: tỷ lệ tăng trưởng, chênh lệch đơn so hôm qua, trường hợp thiếu quyền (403). `AdminDashboardApiTest.java`.

---

## Module Báo cáo (Reports)

File chính: `bigbike-admin/src/screens/ReportsScreen.jsx` · API: `GET /api/v1/admin/reports/analytics` + 3 endpoint xuất file · quyền `reports.read`/`reports.export` (roles `ADMIN`/`SUPER_ADMIN`/`SHOP_MANAGER`).

### MEDIUM

1. **Bộ lọc "Tuỳ chọn" gọi báo cáo ngay cả khi mới điền 1 trong 2 ô ngày**, gây gọi máy chủ dư thừa và có thể thoáng hiện số liệu gắn nhãn "Tuỳ chọn" gây hiểu nhầm. `ReportsScreen.jsx:198-240`. Đề xuất: chỉ fetch khi cả 2 ô ngày đã có giá trị.
2. **Nếu điền "đến ngày" trước "từ ngày", báo cáo có thể tính sai khoảng thời gian.** Đã xác minh trong code: khi thiếu "từ ngày", service tự lấy mặc định "29 ngày trước hôm nay" mà không đối chiếu với "đến ngày" đã điền → nếu "đến ngày" là quá khứ xa, khoảng lọc bị đảo ngược, báo cáo âm thầm trả "0 đơn" thay vì báo lỗi. Chỉ xảy ra thoáng qua lúc đang nhập liệu, tự hết khi điền đủ 2 ô; không ảnh hưởng dữ liệu đã xuất file. `AdminReportService.java:71-78` (`getAnalytics`). Đề xuất: sửa cùng với mục #1 ở trên.
3. **Lỗi mất mạng hiện nguyên câu kỹ thuật tiếng Anh** (vd "Failed to fetch") thay vì ngôn ngữ nghiệp vụ — trái quy ước dự án. `ReportsScreen.jsx:396`, `adminApi.js:204-210` (`normalizeError`). Đề xuất: bọc lỗi mạng thành "Không thể kết nối máy chủ, vui lòng kiểm tra mạng".
4. **Biểu đồ "Doanh thu theo ngày" biến mất hoàn toàn khi khoảng ngày chỉ có 0-1 điểm dữ liệu**, không có khung/thông báo thay thế — khác với khối Top sản phẩm/khách hàng vẫn hiện "Không có dữ liệu". `ReportsScreen.jsx:435`. Đề xuất: hiện "Không đủ dữ liệu để vẽ biểu đồ".
5. **Bộ lọc ngày không được giữ khi rời màn hình rồi quay lại** — mất lựa chọn, về mặc định 30 ngày. `ReportsScreen.jsx:192-194`. Đề xuất: đồng bộ filter vào URL.
6. **Màn Báo cáo gọi lại API mỗi lần đổi tab kỳ**, không tận dụng bộ nhớ đệm react-query như các màn khác trong hệ thống. `ReportsScreen.jsx:209-240`. Đề xuất: cân nhắc chuyển sang cùng cơ chế cache khi refactor.
7. **Xuất file "Khách hàng" không báo lỗi khi lọc theo trạng thái không hợp lệ** — 2 endpoint export kia trả lỗi rõ ràng, riêng endpoint này âm thầm trả file rỗng. Rủi ro thực tế thấp vì UI hiện không có ô lọc trạng thái cho export Khách hàng. `AdminReportController.java:97-110`, `AdminReportService.java:198-206`. Đề xuất: thêm kiểm tra hợp lệ giống 2 endpoint kia.

### LOW

- **Đoạn mã tính "tiền hoàn"/"doanh thu ròng" còn sót** dù backend đã bỏ 2 trường này (không gây bug hiển thị, chỉ là code chết). `adminApi.js:1472,1476-1478` (`normalizeAnalytics`).
- **Nút "Thử lại" không có tác dụng khi lỗi do chọn ngày sai** — chạy lại đúng cặp ngày sai đó. `ReportsScreen.jsx:213-218,392-400`.
- **11 nhãn chữ thiếu trong file ngôn ngữ** (tương tự Tổng quan) — không phải lỗi hiện tại vì UI luôn chạy tiếng Việt.
- **Ô chọn ngày "Tuỳ chọn" không chặn chọn ngày tương lai.** `ReportsScreen.jsx:331-345`.
- **Lưu ý "xuất toàn bộ, không theo khoảng ngày" chỉ hiện qua hover tooltip** — không hiện trên thiết bị cảm ứng. `ReportsScreen.jsx:355,361`.
- **Giá trị đơn TB hiện "0 ₫" khi không có đơn nào**, dễ đọc nhầm ý nghĩa. `ReportsScreen.jsx:296-303`.
- **2 hệ CSS tooltip biểu đồ song song** (Báo cáo vs Tổng quan) hơi lệch style dù cùng token màu. `admin-layout.css:297-313` vs `admin-prototype.css:604-615`.
- **Chưa có giới hạn khoảng ngày tối đa** cho báo cáo phân tích — chưa gây chậm với dữ liệu hiện tại (~1.670 đơn), nên tính trước khi data lớn dần.
- **Cảnh báo "file xuất bị cắt bớt" có thể báo nhầm đúng lúc tròn 10.000 dòng.** `AdminReportService.java:192,240,288`.
- **Còn sót ghi chú code nhắc "REFUNDED" đã bị gỡ** — không ảnh hưởng kết quả, chỉ gây hiểu nhầm khi đọc code. `AdminReportService.java:80,83`, `AdminDashboardSummaryResponse.java:17-18`.

---

## Phát hiện chung & khoảng trống tài liệu

### MEDIUM

1. **3 bài test tự động còn tạo đơn "Đã hoàn tiền" (REFUNDED) đã bị khai tử từ 23/06.** DB thật hiện có 0 đơn REFUNDED (đã tự tay truy vấn xác nhận: 605 COMPLETED, 511 PROCESSING, 388 PENDING, 161 CANCELLED, 5 ON_HOLD, 3 FAILED) và có CHECK constraint chặn giá trị này (`V261__remove_return_and_refund.sql`). 3 test vẫn tạo đơn giả với status này: `AdminDashboardApiTest.java:119-133` (1 test đang FAIL sai kết quả, chạy trên H2 không CHECK constraint) và `AdminReportRepositoryQueryTest.java` (`topProducts_refundedOrdersExcluded_fromRanking`, `topCustomers_refundedOrdersExcluded_fromRanking` — 2 test này dùng Testcontainers Postgres thật có Flyway, sẽ ERROR thẳng nếu Docker khả dụng trong CI). Không ảnh hưởng số liệu thật đang hiển thị cho chủ shop. Đề xuất: đổi cả 3 chỗ tạo đơn test từ REFUNDED sang CANCELLED.
2. **`DATA_CONTRACT.md` thiếu mô tả 5/7 trường KPI của Tổng quan** (`todayRevenuePct`, `todayOrders`, `todayOrdersDelta`, `pendingOrders`, `activeProducts`) và toàn bộ 4 danh sách dữ liệu (`revenueData`, `orderStatusBreakdown`, `recentOrders`, `topProducts`). `docs/engineering/DATA_CONTRACT.md:1196-1209` vs `AdminDashboardSummaryResponse.java:16-24`.
3. **`API_CONTRACT.md` chỉ ghi 1/3 endpoint xuất file của Báo cáo** — `orders/export` có mô tả đầy đủ, `customers/export` và `products/export` (đã có trong code + `PERMISSION_MATRIX.md`) không có dòng riêng. `docs/engineering/API_CONTRACT.md:411-430` vs `AdminReportController.java:97-130`.
4. **`DATA_CONTRACT.md` thiếu field `orders` trong mục "doanh thu theo ngày"** và ghi sai kiểu field `orderCount` (int thay vì long thực tế). `docs/engineering/DATA_CONTRACT.md:1243-1248,1266` vs `AdminAnalyticsResponse.java`.

### LOW

- **`MODULE_CATALOG.md` chưa liệt kê Tổng quan/Báo cáo như 2 module riêng** — hiện chỉ nhắc thoáng qua trong mục "Inventory admin".

---

## Đã xác nhận đúng / tốt

- Không có số liệu giả/hardcode ở bất kỳ đâu trong 2 màn hình — 100% dữ liệu thật từ API.
- Phân quyền chuẩn xác — đã tự tay truy vấn `role_permissions` thật: chỉ `ADMIN`/`SHOP_MANAGER` (đủ quyền) và `SUPER_ADMIN` (`*`) thấy doanh thu; `EDITOR` không có quyền nào trong 3 quyền `orders.read`/`reports.read`/`reports.export`.
- Giao diện tự ẩn đúng menu Tổng quan/Báo cáo cho tài khoản không đủ quyền, kèm chặn cả truy cập trực tiếp qua đường dẫn.
- Vấn đề "Tổng quan đứng hình, không tự cập nhật" từng ghi nhận ở `REALTIME_DATA_FETCHING_AUDIT_2026-06-11.md` (mục P5) **đã được khắc phục** — nay tự làm mới mỗi 90 giây + khi quay lại tab.
- Mọi trạng thái rỗng (chưa có đơn/sản phẩm/dữ liệu biểu đồ) ở Tổng quan đều có thông báo tử tế, không lộ "NaN/undefined".
- Chia cho 0 khi tính tỷ lệ tăng trưởng được chặn đúng cách ở cả 2 module.
- Toàn bộ màu biểu đồ dùng token thương hiệu, hiển thị đúng ở cả giao diện sáng/tối.
- Chú thích và tooltip biểu đồ đầy đủ, không dựa hoàn toàn vào màu (trừ điểm trùng màu đã nêu).
- Định dạng tiền VNĐ nhất quán, không lỗi tràn/cắt chữ kể cả số tiền lớn.
- Cả 3 nút xuất file (Đơn hàng/Khách hàng/Sản phẩm) ở Báo cáo đều hoạt động, đều báo khi file bị cắt bớt.
- So sánh doanh thu với kỳ trước xử lý đúng cả trường hợp gọi kỳ trước bị lỗi (không làm sập kỳ hiện tại).
- Giờ giấc "hôm nay/theo ngày" nhất quán theo múi giờ Việt Nam xuyên suốt backend + query, không lệch ở ranh giới nửa đêm.
- Xuất CSV chống được ký tự đặc biệt/công thức độc hại, có 27 test tự động bao phủ.
- Xử lý lỗi backend tuân đúng quy ước dự án (gom lỗi tập trung qua `@ControllerAdvice`), không có try/catch thủ công rải rác.
- Không phát hiện CSS chết ở cả 2 màn hình đã kiểm tra.
- Không gọi API trùng lặp, không tải lại chart thừa ở Tổng quan.
- Đợt dọn tính năng hoàn tiền thực hiện sáng 2026-07-04 (FE + BE + docs cùng lúc) sạch sẽ, không sót tham chiếu nào gây lỗi hiển thị.
- API báo cáo khi gọi không kèm tham số ngày vẫn trả mặc định hợp lý (30 ngày gần nhất).
