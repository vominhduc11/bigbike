-- V258: Backfill khối "Mua tại BigBike.vn" — đảm bảo MỌI sản phẩm có sẵn 3 dòng tiêu chuẩn
-- (Bảo hành / Giao hàng / Đổi size) để trust block hiện ĐỦ theo mẫu "J. TRUST BLOCK"
-- (Giá · Kho · Bảo hành · Giao hàng · Đổi size · Liên hệ · Địa chỉ). Trước đây 3 dòng này là
-- "dòng admin tự nhập theo từng sản phẩm" (V252) nên ~1.230/1.232 SP để trống → web chỉ hiện 4 ô.
--
-- Chỉ chèn cho sản phẩm CHƯA có dòng nào (V252 đã backfill các SP còn số liệu cũ — giữ nguyên,
-- không đụng). Giá trị = chính sách chung của shop; admin sửa riêng từng SP khi cần (vd số tháng
-- bảo hành khác nhau). Đổi size = 30 ngày theo quyết định vận hành.

create temporary table _bb_empty_purchase_products on commit drop as
select p.id
from products p
where not exists (select 1 from product_purchase_lines l where l.product_id = p.id);

-- Bảo hành (sort 0)
insert into product_purchase_lines (product_id, sort_order, icon, label, value, label_en, value_en)
select e.id, 0, 'shield-check', 'Bảo hành', '12 tháng tại BigBike', 'Warranty', '12 months at BigBike'
from _bb_empty_purchase_products e;

-- Giao hàng (sort 1)
insert into product_purchase_lines (product_id, sort_order, icon, label, value, label_en, value_en)
select e.id, 1, 'truck', 'Giao hàng', 'Toàn quốc · COD · Đồng kiểm khi nhận', 'Shipping', 'Nationwide · COD · check on delivery'
from _bb_empty_purchase_products e;

-- Đổi size (sort 2) — miễn phí 30 ngày
insert into product_purchase_lines (product_id, sort_order, icon, label, value, label_en, value_en)
select e.id, 2, 'refresh-cw', 'Đổi size', 'Miễn phí đổi trong 30 ngày nếu không vừa', 'Size exchange', 'Free size exchange within 30 days'
from _bb_empty_purchase_products e;
