-- Gỡ hẳn "Khoá bán (buộc hết hàng)" (owner decision 2026-07-19): ô này từng là 1 override cứng
-- ở mức sản phẩm, chặn mua trên web bất kể trạng thái biến thể (STOCK_RULE_004). Owner xác nhận
-- gỡ hoàn toàn hành vi override cho sản phẩm CÓ biến thể (giờ chỉ còn công tắc Còn/Hết theo từng
-- biến thể quyết định). Riêng sản phẩm KHÔNG biến thể vẫn cần 1 công tắc Còn/Hết ở mức sản phẩm
-- (trước đây chính là force_out_of_stock đảo dấu) — cột này được thay bằng "available" (thuận
-- dấu: true = còn hàng), 0 sản phẩm nào đang bật force_out_of_stock tại thời điểm chạy migration
-- nên backfill chỉ đơn thuần đảo dấu, không đổi hành vi sản phẩm nào.

alter table products add column available boolean not null default true;

update products
set available = not coalesce(force_out_of_stock, false);

alter table products drop column force_out_of_stock;
