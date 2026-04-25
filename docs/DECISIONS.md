# Architecture & Product Decisions

## [2026-04-25] Section Videos trang chủ bị loại bỏ

**Quyết định:** Không implement section "TRẢI NGHIỆM SẢN PHẨM CÙNG BIGBIKE.VN" (video carousel) từ WP gốc vào bigbike-web.

**Lý do:**
- Tất cả 5 video hiển thị trên WP homepage đều là **YouTube Shorts (9:16 dọc)** — không phù hợp với carousel ngang trên desktop.
- Tiêu đề video là tên nội bộ ngắn ("354", "forma low", "oneal") — không display-ready, cần làm sạch toàn bộ 62 bản ghi trước khi dùng được.
- Chi phí implement (Video entity, migration, ETL, API endpoint, frontend component, Shorts embed) lớn hơn giá trị mang lại.
- ETL backend đã bỏ qua `post_type='video'` — không cần thêm guard.

**Hệ quả:**
- Không tạo entity `Video`, không có endpoint `/api/v1/videos`.
- ETL giữ nguyên, không import `post_type='video'`.
- Nếu muốn tái xem xét trong tương lai: cần chuẩn hóa tiêu đề video và thiết kế riêng layout cho Shorts (ví dụ grid dọc hoặc trang `/video` riêng).
