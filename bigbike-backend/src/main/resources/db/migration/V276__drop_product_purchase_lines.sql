-- V276: Gỡ HẲN module "dòng tự thêm" của khối "Mua tại BigBike.vn" (product_purchase_lines, V252/V249).
-- Quyết định chủ shop (2026-06-24): 3 dòng Bảo hành / Giao hàng / Đổi size gần như giống nhau ở mọi SP
-- nên không cần admin quản theo từng SP. Khối "Mua tại BigBike.vn" trên web vẫn còn nhưng chỉ còn các ô
-- tự động (Giá + Tồn kho realtime, Liên hệ + Địa chỉ từ site_settings). Field purchaseLines đã gỡ khỏi
-- domain/API/admin/web cùng đợt này.
--
-- Cột scalar legacy pdp_shipping_line / pdp_return_line trên products vẫn dormant (không đụng).

drop index if exists idx_product_purchase_lines_product_id;
drop table if exists product_purchase_lines;
