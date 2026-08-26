# Migration tạm hoãn

Các file ở đây KHÔNG được Flyway quét (`spring.flyway.locations=classpath:db/migration`).

## V1047__require_complete_variant_attribute_links.sql

Tạm hoãn ngày 2026-08-21 theo quyết định của owner: migration dừng an toàn vì
378 dòng `product_variant_options` chưa ghép được thuộc tính/giá trị, làm backend
crash-loop và sập bigbike.vn (503) hơn 2 giờ.

Cần làm trước khi bật lại:
1. Ghép tên thuộc tính tiếng Việt còn thiếu: `Màu` → `color`, `Kích cỡ` → `size`,
   `Đời máy` → `model` (178 dòng).
2. Bổ sung 41 giá trị còn thiếu vào `attribute_values` (vd `OLIVE`, `gunmetal`,
   `ronin-blue`, size `58/60/62/4XL/5XL`) — 195 dòng.
3. Sửa 5 nhóm nhãn trùng trong từ điển màu (vd `e3-denhongblackpink` đang mang
   nhãn `ĐEN BÓNG` trùng với `den-bong`).

Bật lại: chuyển file về `db/migration`. `SPRING_FLYWAY_OUT_OF_ORDER=true` đã bật
nên V1047 vẫn chạy được sau V1048/V1049.
