# Báo cáo kiểm tra module Nhật ký (Audit Log) — Sẵn sàng Production

**Ngày kiểm tra:** 04/07/2026
**Phạm vi:** Module "Nhật ký hoạt động" trong khu quản trị BigBike (ghi log + màn hình xem log)
**Hình thức:** Audit read-only — chỉ điều tra, không sửa code
**Phương pháp:** Đọc tài liệu nội bộ liên quan (`MODULE_CATALOG.md`, `API_CONTRACT.md`, `DATA_CONTRACT.md`, `PERMISSION_MATRIX.md`, `BUSINESS_RULES.md`, `STATE_MACHINES.md`) → đọc code thực tế → truy vấn trực tiếp dữ liệu thật trên máy chủ đang chạy (`bigbike-postgres`, 1.420+ dòng, khoảng thời gian 2026-05-04 → 2026-07-04) → gọi thử trực tiếp API thật (`bigbike-backend`, chỉ lệnh xem) để tái hiện lỗi trước khi kết luận.

---

## 1. Kết luận tổng

## → **CÓ ĐIỀU KIỆN**

An toàn để tiếp tục vận hành — không phát hiện mất dữ liệu, không rò rỉ mật khẩu/thông tin nhạy cảm, phân quyền đúng thiết kế. Nhưng **chưa đạt giá trị cốt lõi** mà một cuốn nhật ký cần có: biết rõ ai đã đổi **cái gì**, trên **đối tượng nào** — với thao tác sửa sản phẩm và danh mục (hơn một nửa tổng số nhật ký toàn hệ thống), hệ thống chỉ ghi "có sửa" mà không ghi nội dung đã đổi.

Khuyến nghị xử lý các mục ưu tiên cao ở mục 3 trước khi dùng nhật ký này làm căn cứ tra khiếu nại hoặc điều tra truy cập bất thường.

### Số liệu thực tế (2026-05-04 → 2026-07-04)

| Chỉ số | Giá trị |
|---|---|
| Tổng số dòng nhật ký đã ghi | 1.420+ |
| Số lần mất dữ liệu / lỗi ghi log phát hiện được | 0 |
| Số lần lộ mật khẩu / token phát hiện được (rà toàn bộ dữ liệu) | 0 |
| Tỷ lệ dòng không hiện được tên sản phẩm/danh mục cụ thể (hiện dấu "—") | ~62% |
| Tỷ lệ dòng (sửa sản phẩm + danh mục) không lưu nội dung đã đổi | ~51% |

---

## 2. Đã kiểm tra và xác nhận an toàn

- Ghi log chạy tách giao dịch riêng (`@Transactional(REQUIRES_NEW)`, có bắt lỗi) — nếu ghi log lỗi cũng **không** làm hỏng thao tác nghiệp vụ chính. Xác nhận qua code: `AuditLogWriter.java`, `AuditLogPersister.java`.
- Rà toàn bộ dữ liệu thật (từ khóa mật khẩu/token/secret): **0 kết quả**. Cơ chế che dữ liệu nhạy cảm (cài đặt hệ thống chứa `secret`/`password`/`token`/`api_key`...) được áp dụng **trước khi lưu xuống**, không phải chỉ che lúc hiển thị — xác nhận tại `AdminSettingsService.snapshot()`. Mật khẩu tài khoản quản trị không bao giờ được ghi vào log (`AdminAdminUsersService` chỉ ghi `"passwordChanged": true`).
- Phân quyền đúng thiết kế: chỉ **Admin** và **Super Admin** xem được nhật ký, **Quản lý cửa hàng** và **Biên tập viên** không xem được — xác nhận cả ở dữ liệu phân quyền thật trong CSDL, cả khi thử trực tiếp trên giao diện (menu bị ẩn + vào thẳng link cũng bị chặn với thông báo "Không có quyền truy cập").
- Không có cách nào sửa hoặc xoá nhật ký đã ghi qua hệ thống hiện tại — chỉ có chức năng xem, không có chức năng sửa/xoá.
- Nhập liệu sai (số trang âm, số dòng mỗi trang quá lớn...) đều bị chặn với thông báo lỗi rõ ràng, không bị vỡ trang hay lỗi hệ thống.
- Giao diện tiếng Việt đầy đủ dấu, không lỗi phông chữ; thời gian hiển thị đúng theo giờ Việt Nam.

---

## 3. Vấn đề nên sửa (xếp theo mức độ ảnh hưởng)

### 🟠 3.1 — Không thấy rõ đã sửa cái gì, trên sản phẩm/danh mục nào *(ưu tiên cao nhất)*

Thao tác sửa sản phẩm và sửa danh mục — **hơn một nửa tổng số nhật ký toàn hệ thống** — chỉ ghi lại tên/mã/trạng thái, không ghi giá, tồn kho, mô tả hay hình ảnh đã đổi, và không lưu "trước khi sửa" để so sánh. Trên màn hình Nhật ký, cột "Đối tượng" hiện dấu gạch ngang cho phần lớn các dòng này thay vì tên sản phẩm thật.

**Bằng chứng:**
- Dữ liệu thật: 736/1.420 dòng (`PRODUCT_UPDATED` + `CATEGORY_UPDATED`) không có nội dung "trước khi sửa".
- `AdminCatalogMutationService.java` — nhiều vị trí (`updateProduct`, `updateCategory`, `updateBrand`, `softDeleteProduct`...) truyền `null` thay vì snapshot trước khi sửa, dù entity đã được lấy ra ngay trước đó.
- `AdminHomeVideoService.java`, `AdminSliderService.java`, `AdminContentMutationService.java` — cùng kiểu lỗi.
- `AdminAuditLogService.java:138-176` — chỉ "làm giàu" tên hiển thị cho loại `ORDER` và `REVIEW`, 14/16 loại còn lại (gồm cả PRODUCT/CATEGORY chiếm khối lượng lớn nhất) luôn trả về tên rỗng dù tên sản phẩm đã có sẵn trong dữ liệu.
- `bigbike-admin/src/screens/audit-log-list/cells.jsx:38-46` — giao diện hiện dấu "—" khi không có tên.
- **Nguyên nhân gốc:** không có một "khuôn ghi log" dùng chung — mỗi nhóm chức năng (sản phẩm, menu, cài đặt, đơn hàng...) tự viết code ghi log riêng, nên chỗ làm đúng (Menu, Media, Cài đặt, Đơn hàng, Khách hàng, Phân quyền) và chỗ làm thiếu (Sản phẩm, Danh mục, Thương hiệu, Video/Slider trang chủ, Bài viết) tồn tại song song.

### 🟠 3.2 — Ô tìm kiếm hứa nhưng không tìm được *(ưu tiên cao)*

Ô tìm kiếm gợi ý "Tìm mã đơn, sản phẩm, khách hàng, người thao tác…" nhưng thực tế chỉ tìm được trong **tên loại hành động**. Gõ tên sản phẩm hay mã đơn để tra lại lịch sử sẽ luôn ra "không có kết quả" — dễ khiến người dùng tưởng nhầm là không có lịch sử.

**Bằng chứng:**
- `bigbike-admin/src/locales/vi.json:2078` — dòng gợi ý tìm kiếm.
- `AdminAuditLogService.java:86-88` — chỉ so khớp cột `action`, không đụng tới tên sản phẩm/mã đơn/người thao tác.
- Đã thử trực tiếp trên hệ thống thật: gõ tên sản phẩm có thật trong dữ liệu → 0 kết quả; gõ một phần tên hành động (VD "LOGIN") → ra kết quả đúng.

### 🟠 3.3 — Không lọc/không dịch được lịch sử đăng nhập — IP ghi lại vô nghĩa *(ưu tiên cao)*

Không thể lọc riêng "đăng nhập / đăng xuất / khoá tài khoản" trên màn hình Nhật ký — nhóm quan trọng nhất để phát hiện truy cập trái phép. Khi hiện trong danh sách chung, tên hành động hiện mã kỹ thuật tiếng Anh (VD `(ADMIN_LOGIN_FAILED)`) thay vì tiếng Việt. Đồng thời, địa chỉ IP ghi lại cho **mọi lượt đăng nhập** chỉ là địa chỉ nội bộ máy chủ, không phải địa chỉ thật của người đăng nhập — không dùng để truy vết được.

**Bằng chứng:**
- `bigbike-admin/src/screens/audit-log-list/constants.js:91-97` — danh sách 16 loại đối tượng lọc được, thiếu `ADMIN_AUTH`/`SLIDER`/`HOME_VIDEO`; không có khoá dịch `auditLog.module.*`/`auditLog.action.*` tương ứng.
- `AdminAuthService.java` — dùng `request.getRemoteAddr()` thô, không đọc header từ reverse-proxy (`X-Forwarded-For`), trong khi `ClientIpResolver.java` (dùng đúng cho vài chỗ khác) đã có sẵn cách làm đúng.
- Dữ liệu thật: toàn bộ 150 lượt đăng nhập/đăng xuất chỉ ra đúng 3 địa chỉ IP, tất cả đều thuộc dải mạng nội bộ Docker (`172.20.0.x`) — chưa từng ghi được IP thật của người dùng trong suốt 2 tháng.

### 🟠 3.4 — Một số thao tác quản trị không để lại dấu vết *(ưu tiên vừa)*

Tạo/sửa/xoá thư mục trong thư viện ảnh, thêm/sửa thuộc tính sản phẩm (màu, size...), và lưu mục "nổi bật trang chủ" — cả ba đều không ghi nhật ký.

**Bằng chứng:** `AdminMediaFolderService.java`, `AdminAttributeService.java`, `HomeHighlightsService.java` — rà toàn bộ file, không có lệnh ghi nhật ký nào.

### 🟠 3.5 — Lọc sai ngày/mã sẽ âm thầm hiện toàn bộ dữ liệu *(ưu tiên vừa)*

Nếu gõ sai định dạng ngày khi lọc, hoặc lọc theo mã người dùng/mã đối tượng không hợp lệ, hệ thống không báo lỗi mà âm thầm bỏ qua bộ lọc và hiện lại toàn bộ lịch sử — dễ gây hiểu lầm là đã lọc đúng.

**Bằng chứng:**
- Đã thử trực tiếp trên hệ thống thật: `GET /api/v1/admin/audit-logs?from=not-a-date` và `?actorId=not-a-uuid` đều trả về **200 OK** kèm toàn bộ dữ liệu không lọc, thay vì báo lỗi hoặc trả rỗng.
- `AdminAuditLogService.java:73-85, 208-226` — lỗi phân tích ngày/mã bị `catch` và bỏ qua trong im lặng.
- So sánh: `AdminReportController.java:153-165` xử lý tình huống tương tự đúng cách — báo lỗi 400 rõ ràng thay vì bỏ qua. Đây là điểm không đồng nhất giữa 2 module dùng chung một kiểu tham số ngày tháng.

### 🟢 3.6 — Một số thao tác gộp chung tên, khó phân biệt nhanh *(ưu tiên thấp)*

Vô hiệu hoá, tạm khoá, hay đổi vai trò một tài khoản quản trị đều ghi chung một tên hành động (`ADMIN_USER_UPDATED`). Nội dung trước/sau vẫn được lưu đầy đủ và đúng — chỉ là khó phân biệt loại thao tác khi lướt nhanh danh sách.

**Bằng chứng:** `AdminAdminUsersService.java:158-253`.

---

## 4. Đề xuất cải thiện thêm (không gấp)

| # | Đề xuất | Ghi chú |
|---|---|---|
| 1 | Bổ sung vào tài liệu kỹ thuật nội bộ 3 nhóm dữ liệu đang thực sự được ghi nhưng chưa liệt kê: Video trang chủ, Slider trang chủ, Xuất báo cáo | `API_CONTRACT.md` §"Audit Log Contract"; chỉ ảnh hưởng đội kỹ thuật |
| 2 | Đảm bảo thứ tự hiển thị ổn định khi nhiều dòng trùng đúng thời điểm (đã thấy thực tế khi lưu hàng loạt) | `AdminAuditLogService.java:98-101` — sắp xếp chỉ theo thời gian, chưa có tiêu chí phụ |
| 3 | Tách việc ghi log ra chạy nền hoàn toàn thay vì chạy ngay trong lúc xử lý thao tác chính | Chưa gây chậm ở quy mô hiện tại (~23 dòng/ngày); hệ thống đã có sẵn cơ chế chạy nền cho tính năng khác |
| 4 | Giới hạn dung lượng nội dung "trước/sau" khi lưu | Hiện còn nhỏ (trung bình ~100 ký tự) nên chưa phát sinh vấn đề, nhưng chưa có giới hạn |
| 5 | Sửa 2 nhãn màu cảnh báo (Cài đặt hệ thống, Phân quyền) đang không lên đúng màu đỏ như thiết kế | Chỉ ảnh hưởng thẩm mỹ — `cells.jsx`/`AuditCard.jsx`/`AuditDetailDrawer.jsx` dùng sai tên loại (`SETTING`/`ROLE` thay vì `SITE_SETTING`/`ADMIN_ROLE`) |
| 6 | Đưa màn hình Nhật ký về cùng cách tải dữ liệu (react-query) với các màn hình khác trong khu quản trị | Không lỗi, chỉ khác quy ước, hơi khó bảo trì về sau |

---

## 5. Việc cần làm — theo thứ tự ưu tiên

1. **Ghi đầy đủ nội dung trước/sau** khi sửa sản phẩm, danh mục, thương hiệu, video trang chủ (giá, tồn kho, mô tả, hình ảnh...) — và hiện tên thật thay vì dấu gạch ngang trên màn hình Nhật ký.
2. **Sửa ô tìm kiếm** cho đúng với những gì đã hứa — tìm theo tên sản phẩm/mã đơn/người thao tác thật, hoặc đổi lại nội dung gợi ý cho khớp thực tế.
3. **Thêm bộ lọc + bản dịch cho nhóm đăng nhập/đăng xuất/khoá tài khoản** — nhóm quan trọng nhất để phát hiện truy cập bất thường.
4. **Sửa để ghi đúng địa chỉ mạng thật** của người đăng nhập thay vì địa chỉ nội bộ máy chủ.
5. **Bổ sung ghi nhật ký** cho thư mục thư viện ảnh, thuộc tính sản phẩm, mục nổi bật trang chủ.
6. **Báo lỗi rõ ràng khi lọc sai định dạng** thay vì âm thầm hiện lại toàn bộ dữ liệu.
7. Cập nhật tài liệu kỹ thuật nội bộ và xử lý các đề xuất nhỏ còn lại ở mục 4 (không gấp).

---

## 6. Ghi chú

Trong lúc kiểm tra, hệ thống có ghi thêm vài dòng "đăng nhập thành công" phát sinh từ chính quá trình thử nghiệm API (đăng nhập bằng tài khoản kiểm thử có sẵn của dự án, chỉ dùng lệnh xem) — không phải hoạt động thật, không ảnh hưởng dữ liệu kinh doanh.

Không có mục nào trong tài liệu nội bộ liên quan bị đánh dấu "cần xác minh thêm" hoặc mâu thuẫn giữa các nguồn tại thời điểm kiểm tra.

Báo cáo dạng trình bày trực quan: https://claude.ai/code/artifact/b32479ca-868b-4584-9b12-38daf663902b
