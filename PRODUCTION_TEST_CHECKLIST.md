# BigBike — Checklist kiểm thử Production-Ready

> Mục đích: tự test toàn hệ thống trước khi đưa lên production. Tick từng mục khi đã test xong và kết quả đúng kỳ vọng.
>
> Ký hiệu:
> - 🔴 = khu vực docs ghi "chưa kiểm chứng runtime / thiếu test tự động" → test kỹ nhất.
> - Nguồn nghiệp vụ: `docs/business/STATE_MACHINES.md`, `MODULE_CATALOG.md`, `WORKFLOW_OVERVIEW.md`, `USER_ROLES.md`, `BUSINESS_RULES.md`.

---

## A. Catalog — Sản phẩm, danh mục, thương hiệu

### 1. Sản phẩm
- [ ] Tạo sản phẩm mới (đủ ảnh, mô tả, giá, danh mục, thương hiệu) → lưu thành công, hiện đúng ngoài web
- [ ] Sản phẩm có biến thể (size/màu): nhiều variant, mỗi variant giá/tồn riêng → web chọn variant đổi giá/ảnh đúng
- [ ] Vòng đời trạng thái: Nháp → Đăng → Ẩn → Thùng rác → Khôi phục
- [ ] Sản phẩm Nháp/Ẩn KHÔNG hiện ngoài web (listing, search, link trực tiếp)
- [ ] Sản phẩm Đăng mới hiện ngoài web
- [ ] Không cho đi thẳng "Đăng → Nháp" (phải qua Ẩn)
- [ ] Tồn kho khởi tạo: sản phẩm mới luôn hết hàng (qty=0) cho tới khi nhập kho
- [ ] Nội dung song ngữ Việt/Anh: đổi ngôn ngữ → tên/mô tả đổi đúng; trường tiếng Anh trống fallback về tiếng Việt
- [ ] SEO: slug, ảnh đại diện, mô tả meta hiển thị đúng khi share link

### 2. Danh mục & thương hiệu
- [ ] Tạo/sửa danh mục nhiều cấp, sắp xếp cây danh mục
- [ ] Không cho ẩn danh mục cha khi còn danh mục con đang hiển thị (báo lỗi)
- [ ] Ẩn danh mục/thương hiệu → biến mất khỏi web; mega-menu header cập nhật đúng
- [ ] Menu sản phẩm desktop (mega menu 4 cấp) và mobile (accordion) hiển thị đúng cây

---

## B. Nội dung — Blog, trang, media, giao diện

### 3. Blog / Bài viết & Trang nội dung
- [ ] Tạo bài viết blog (ảnh, nội dung rich text, danh mục) → Nháp/Đăng/Ẩn/Thùng rác
- [ ] Bài Nháp/Ẩn không hiện ngoài web; bài Đăng hiện ở trang tin tức + chi tiết
- [ ] Trang nội dung (CMS page) + hero banner (ảnh, tiêu đề, mô tả) hiển thị đúng
- [ ] Mục lục (ToC), bài liên quan, chia sẻ mạng xã hội hoạt động

### 4. Media
- [ ] Upload ảnh hợp lệ → lưu, hiển thị; gắn vào sản phẩm/bài viết
- [ ] Từ chối file giả mạo định dạng, file rỗng, file SVG, file không hỗ trợ (test bảo mật)
- [ ] Xóa mềm → khôi phục; xóa cứng → mất hẳn cả file lẫn metadata
- [ ] Thư mục media, tìm/lọc, lightbox xem trước

### 5. Giao diện vận hành (Editor)
- [ ] Menu (primary/footer/guide): thêm/sửa/sắp xếp item; không cho tạo/xóa slot hệ thống
- [ ] Slider trang chủ, video trang chủ, settings (logo, thông tin liên hệ) cập nhật → web đổi đúng

---

## C. Luồng mua hàng online (Khách + Khách vãng lai)

### 6. Duyệt & tìm kiếm
- [ ] Tìm kiếm + gợi ý tìm kiếm trả đúng sản phẩm đang đăng
- [ ] So sánh sản phẩm (tối đa 3, cùng danh mục), wishlist (cần đăng nhập)

### 7. Giỏ hàng
- [ ] Thêm/sửa số lượng/xóa; giỏ khách vãng lai giữ qua phiên (cookie)
- [ ] Đăng nhập giữa chừng → giỏ không mất
- [ ] Áp mã giảm giá: mã hợp lệ giảm đúng; mã hết hạn/sai/đã dùng → báo lỗi

### 8. Đặt hàng (checkout) 🔴
- [ ] Checkout khách vãng lai và khách đã đăng nhập đều đặt được
- [ ] Hệ thống kiểm tra lại giá/tồn/coupon/phí ship lúc đặt (đổi giá hoặc hết hàng giữa chừng phải chặn)
- [ ] Chọn địa chỉ Tỉnh → Huyện → Xã đúng; tính phí ship theo zone/method
- [ ] Thanh toán COD → đơn Đang xử lý; chuyển khoản (BACS) → Tạm giữ
- [ ] Đặt xong: trừ tồn kho đúng, gửi email xác nhận, admin nhận thông báo real-time
- [ ] Quick-buy (mua nhanh) một sản phẩm chạy đúng như checkout
- [ ] 🔴 Chống đặt trùng: bấm đặt 2 lần nhanh / mất mạng giữa chừng → chỉ tạo 1 đơn (idempotency)
- [ ] 🔴 Chống bán âm kho (oversell): 2 người mua cùng lúc sản phẩm còn 1 cái → chỉ 1 người thành công

---

## D. Xử lý đơn hàng (Admin)

### 9. Trạng thái đơn 🔴 (docs: thiếu test tự động → test tay kỹ)
- [ ] Luồng chuẩn: Đang xử lý → Hoàn thành; Tạm giữ → Đang xử lý
- [ ] Hủy đơn: chỉ hủy được khi chưa thu tiền → tự hoàn tồn kho
- [ ] Đơn đã thanh toán KHÔNG cho hủy thẳng (phải hoàn tiền trước)
- [ ] Hoàn thành đơn COD chỉ khi đã thu tiền
- [ ] Đơn chưa trả tiền chỉ hoàn thành nếu là đơn công nợ có khách hàng
- [ ] Trạng thái cuối (Hoàn thành/Hủy/Thất bại/Hoàn tiền) không quay ngược lại được
- [ ] Đơn Thất bại/Hủy → hoàn tồn kho + nhả serial

### 10. Giao vận (fulfillment)
- [ ] Chưa giao → Đang chuẩn bị → Đã gửi (bắt buộc nhập mã vận đơn) → Đã giao → (Trả lại)
- [ ] Không cho nhảy thẳng "Chưa giao → Đã giao"
- [ ] Đơn giao hàng chỉ Hoàn thành sau khi Đã giao

### 11. Thanh toán & hoàn tiền
- [ ] Đánh dấu Đã thanh toán; ghi nhận số tiền/ngày
- [ ] Hoàn tiền qua chức năng refund (không sửa trạng thái tay): hoàn toàn phần, hủy bảo hành, phục hồi serial đã bán, xóa công nợ còn mở, chuyển đơn sang Đã hoàn tiền
- [ ] Đơn đã hoàn tiền không cho thao tác tiếp

---

## E. POS (bán tại quầy)

### 12. Bán POS 🔴
- [ ] Tìm sản phẩm POS, thêm vào hóa đơn
- [ ] Thanh toán Tiền mặt / Quẹt thẻ → đơn tạo ngay Hoàn thành + Đã thanh toán, trừ kho, ghi payment
- [ ] Bán công nợ (CREDIT): tạo đơn gắn khách → sinh khoản phải thu; chỉ cho phép khi khách hợp lệ
- [ ] Nhập tiền khách đưa → tính tiền thối; quyền override giá (kiểm tra phân quyền)
- [ ] Sau bán: ghi audit, system note, snapshot khách/nhân viên, đẩy thông báo đơn mới
- [ ] Chống tạo trùng hóa đơn khi bấm 2 lần (idempotency key)

### 13. Công nợ (Phải thu)
- [ ] Danh sách/chi tiết công nợ; ghi nhận thanh toán; xóa nợ (write-off)
- [ ] Báo cáo tuổi nợ (aging); hồ sơ tín dụng khách + hạn mức
- [ ] Hoàn tiền/đổi-trả đơn công nợ → công nợ tương ứng tất toán đúng

---

## F. Đổi / trả hàng (Return)

### 14. Luồng đổi trả 🔴
- [ ] Khách kiểm tra đủ điều kiện trả trước, chỉ hiện món còn trả được
- [ ] Khách tạo yêu cầu trả từ đơn của mình; xem danh sách trả của mình; KHÔNG xem được đơn người khác
- [ ] Admin duyệt: Chờ → Duyệt/Từ chối → Đã nhận hàng → (Kiểm định) → Hoàn tất / Hoàn tiền
- [ ] Kiểm định từng món PASS/FAIL (bắt buộc cho đồ an toàn: mũ, giáp): món FAIL không nhập lại kho
- [ ] Hoàn tất → phục hồi tồn kho đúng (chỉ món PASS)
- [ ] Hoàn tiền qua return → yêu cầu trả đủ toàn bộ đơn, số tiền khớp, đơn đã thanh toán
- [ ] Trạng thái cuối (Từ chối/Hoàn tất/Hoàn tiền) không quay ngược

---

## G. Kho & tồn

### 15. Tồn kho / nhập hàng
- [ ] Nhập hàng (stock-in) tăng tồn; bán/hủy/trả tự cập nhật trạng thái Còn/Sắp hết/Hết hàng
- [ ] Serial: nhập kho yêu cầu số serial khớp số lượng; theo dõi serial qua bán → trả → phục hồi
- [ ] Điều chỉnh tồn thủ công, lịch sử biến động (IN/OUT/ADJUSTMENT/RETURN), xuất CSV

---

## H. Khuyến mãi

### 16. Coupon & tặng mã
- [ ] Tạo/sửa coupon, điều kiện áp dụng, giới hạn lượt dùng, hết hạn
- [ ] Tặng mã hàng loạt: tạo 1 mã riêng cho mỗi khách đang hoạt động + gửi email → mỗi khách 1 mã đúng
- [ ] Lịch sử coupon của khách hiển thị đúng

---

## I. Tài khoản khách hàng

### 17. Đăng ký / đăng nhập 🔴
- [ ] Đăng ký → gửi email xác nhận; bấm link xác nhận kích hoạt tài khoản; nút gửi lại
- [ ] Đăng nhập bằng email/SĐT + mật khẩu; "Ghi nhớ" giữ phiên 30 ngày (vs 1 ngày)
- [ ] 🔴 Quên mật khẩu / đặt lại mật khẩu: link trong email trỏ đúng localhost:3000 (local) — kiểm tra qua `.env`
- [ ] Đăng nhập Facebook/Google (nếu bật)
- [ ] Profile, sổ địa chỉ (thêm/sửa/xóa, đặt mặc định), lịch sử đơn, danh sách trả

---

## J. Phân quyền & quản trị

### 18. Vai trò admin 🔴 (docs: UI route-guard cần audit riêng)
- [ ] Đăng nhập từng vai trò: Super Admin, Admin, Shop Manager, Editor, Author, Contributor, SEO Editor
- [ ] Mỗi vai trò chỉ thấy/làm đúng module được phép (Editor không vào đơn hàng; Author chỉ content/media)
- [ ] Guardrail Super Admin: không tự hạ quyền mình; không hạ quyền Super Admin cuối cùng; không tự khóa tài khoản mình
- [ ] Tạo/sửa/xóa vai trò tùy chỉnh; không xóa được vai trò hệ thống; không xóa vai trò còn người đang gán
- [ ] 🔴 Xác nhận đăng nhập admin THẬT hoạt động (không phải auth dev/mock — docs cảnh báo DevAdminAuthService ném lỗi ở profile production)
- [ ] Chặn ở backend: khách/khách vãng lai gọi thẳng API admin → bị từ chối (không chỉ ẩn nút UI)

---

## K. Thông báo, vận chuyển, SEO, audit

### 19. Thông báo
- [ ] Admin online: đơn mới đẩy real-time qua WebSocket
- [ ] Admin offline: vào lại thấy thông báo trong Notification Center; đánh dấu đã đọc
- [ ] 🔴 Email giao dịch thật sự gửi tới hộp thư: xác nhận đơn, đổi trạng thái, đổi trả, reset mật khẩu (test SMTP thật)

### 20. Vận chuyển / SEO / Audit
- [ ] Cấu hình zone + phương thức ship → ảnh hưởng đúng phí lúc checkout
- [ ] Redirect cũ→mới hoạt động (SEO migration)
- [ ] Audit log ghi đúng người thao tác, hành động, thời gian; lọc được

---

## L. Xuyên suốt (cross-cutting) — bắt buộc cho production

- [ ] Responsive web: trang chủ, danh sách, chi tiết SP, giỏ, checkout, tài khoản trên mobile (đúng thiết kế, không vỡ)
- [ ] Responsive admin: bảng dữ liệu thu gọn thành card trên mobile/tablet, sidebar 2 trạng thái
- [ ] Song ngữ & tiếng Việt: không lỗi font/mất dấu (mojibake) ở email, toast, label, nút
- [ ] Bảo mật: CSRF cho giỏ/checkout; không truy cập chéo dữ liệu khách khác; upload file độc hại bị chặn
- [ ] Hiệu năng: tải trang chủ/danh sách/tìm kiếm chấp nhận được khi nhiều sản phẩm
- [ ] Môi trường: kiểm tra `.env` (URL email, site/admin, SMTP, CORS, profile dev/prod) trước khi lên thật

---

## Khu vực rủi ro cao nhất — ưu tiên test trước

1. 🔴 Đăng nhập admin ở chế độ production (docs cảnh báo dev-auth)
2. 🔴 Gửi email thật (xác nhận đơn, xác nhận tài khoản, reset mật khẩu)
3. 🔴 Chống bán âm kho & chống đặt/POS trùng (đua tranh đồng thời)
4. 🔴 Chuyển trạng thái đơn / hoàn tiền / đổi-trả — phần lớn chưa có test tự động, dễ sai tiền và sai kho nhất
