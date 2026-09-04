# Audit tự động đồng bộ video trang chủ — 2026-09-02

## Phạm vi

Kênh YouTube chính thức → lịch 04:10 giờ Việt Nam → đọc tối đa 15 video mới nhất → chống trùng/lưu vào `home_videos` → public tối đa 10 video đang bật trên trang chủ.

Tài liệu chuẩn: `docs/business/BUSINESS_RULES.md` (`HOME_VIDEO_RULE_001`–`003`), `docs/business/WORKFLOW_OVERVIEW.md` mục **Homepage YouTube Video Workflow**, và `docs/engineering/API_CONTRACT.md` mục **Home video bilingual title — lang param**.

### F1 — Lịch chạy nhưng không nhập được video từ đúng kênh BigBike

- **Mức độ:** Medium
- **Trạng thái:** Đã sửa, triển khai VPS và đồng bộ thật thành công.
- **Lệch ở đâu:** YouTube trả mã kênh cấp feed không có tiền tố `UC`, trong khi URL feed và từng video dùng mã đầy đủ. Máy chủ so sánh hai dạng nguyên văn, hiểu nhầm là khác kênh và no-op; trang chủ vì vậy tiếp tục hiện 10 video cũ.
- **Bằng chứng runtime:** `docker logs --timestamps --since 30h bigbike-backend` ghi lúc 04:10 ngày 2026-09-02: `youtube_unavailable_or_invalid added=0`; truy vấn chỉ đọc PostgreSQL ghi nhận 59 video, 0 bản ghi `hv_yt_*`, lần cập nhật mới nhất vẫn ở tháng 5; feed công khai của `@bigbike-shop` trả mã đầy đủ `UCgyucblTkYneYrYuGEsxQ6w` ở URL/từng video nhưng `gyucblTkYneYrYuGEsxQ6w` ở cấp feed.
- **Bằng chứng code:** `YouTubeHomeVideoClient.java` trước bản sửa so khớp nguyên văn mã cấp feed; fixture cũ trong `YouTubeHomeVideoClientTest.java` chỉ mô phỏng dạng đầy đủ nên không bắt được dữ liệu thật.
- **Rule liên quan:** `HOME_VIDEO_RULE_001`–`003` — chỉ lấy đúng một kênh chính thức, lỗi ngoài phải no-op an toàn và không được ghi dữ liệu không chắc chắn.
- **Hậu quả vận hành:** Lịch vẫn chạy nhưng không video mới nào vào kho; nhân viên và khách tiếp tục thấy dữ liệu cũ mà không có dấu hiệu thay đổi.
- **Cần owner quyết:** Không. Tài liệu đã chốt một cách đúng duy nhất: nhận đúng hai biểu diễn chính thức của cùng mã kênh, vẫn từ chối mọi kênh khác.
- **Cách sửa:** Chuẩn hoá mã cấp feed về dạng đầy đủ chỉ khi phần rút gọn tạo thành một mã YouTube hợp lệ; bắt buộc mã này khớp đúng kênh đã cấu hình. Mã kênh trên từng video vẫn phải khớp đầy đủ; feed thiếu mã riêng hoặc mang hậu tố của kênh khác vẫn bị từ chối toàn bộ.

### F2 — Các máy chủ biên YouTube trả kết quả RSS không nhất quán

- **Mức độ:** Medium
- **Trạng thái:** Đã sửa và triển khai VPS.
- **Bằng chứng runtime:** Cùng URL RSS và cùng thời điểm, các địa chỉ IPv4 chính thức của `www.youtube.com` trả xen kẽ HTTP 404, 500 và 200. Hai lượt đồng bộ đầu chỉ tới nút lỗi nên no-op an toàn; dữ liệu cũ không bị thay đổi.
- **Hậu quả vận hành nếu không sửa:** Lịch 04:10 có thể bỏ lỡ cả ngày dù feed hợp lệ tồn tại trên một máy chủ YouTube khác.
- **Cách sửa:** Mỗi lượt feed được thử tối đa 8 lần; kết nối không bị ghim vào một nút lỗi và thứ tự địa chỉ DNS được luân phiên. Chỉ phản hồi HTTP 200 có nội dung mới được parse; toàn bộ kiểm tra mã kênh, mã video, URL, tiêu đề, ngày đăng và chống trùng vẫn giữ nguyên.

## Kiểm chứng

- `./mvnw -Dtest=YouTubeHomeVideoClientTest,YouTubeHomeVideoSyncServiceTest,YouTubeHomeVideoSyncWriterTest,HomeVideoApiTest test`: **26/26 đạt**.
- `./mvnw test`: **1.610 ca đạt, 0 lỗi, 1 bỏ qua**; toàn bộ backend build thành công sau bản sửa cuối.
- Smoke test chỉ đọc bằng chính `YouTubeHomeVideoClient` đã sửa với kênh thật: **đạt**, nhận đúng kênh `UCgyucblTkYneYrYuGEsxQ6w`, 15 video, video mới nhất `RNyVn9kPrms`.
- Triển khai bằng `.env.vps`: backend image `b3f72210e38c…` **healthy**, readiness `UP`, restart count `0`.
- Đồng bộ thật lần đầu: `outcome=updated added=15 disabled=0 existing=0`; làm mới web thành công.
- Đồng bộ thật lần hai: `outcome=no_changes added=0 disabled=0 existing=15`; xác nhận không tạo bản ghi trùng.
- PostgreSQL sau đồng bộ: **74 video tổng cộng, 15 video tự động mới**; API công khai trả đúng 10 video mới nhất theo thứ tự.
- HTML công khai `https://bigbike.vn/`: có carousel video và video đầu tiên `RNyVn9kPrms` sau khi revalidate tag `home-videos`.
