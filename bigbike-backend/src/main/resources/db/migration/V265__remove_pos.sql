-- V265: Remove the POS (point-of-sale / in-store / walk-in) feature entirely.
--
-- Owner decision (2026-06-23): BigBike chỉ phục vụ đặt hàng ONLINE. Khách mua
-- trực tiếp tại shop KHÔNG dùng hệ thống nữa. Toàn bộ tính năng bán tại quầy
-- (POS) bị gỡ: endpoint /api/v1/admin/pos/*, màn POS trong admin, và 4 permission
-- pos.read / pos.write / pos.price_override / pos.sell_below_cost.
--
-- Đơn POS cũ (channel = 'IN_STORE', fulfillment_type = 'IN_STORE', source = 'pos')
-- bị XOÁ hẳn theo yêu cầu chủ shop — mất lịch sử doanh thu bán tại quầy.
--
-- Các cột channel / fulfillment_type / source VẪN GIỮ: đơn online dùng
-- fulfillment_type = 'DELIVERY'; chỉ là giá trị IN_STORE/'pos' không còn được tạo.
--
-- Hồ sơ khách "Khách tại quầy" (synthetic) KHÔNG bị xoá: một khách có thể vừa mua
-- tại quầy vừa đặt online (resolveOrCreateCustomerByPhone tái dùng theo SĐT), nên
-- xoá khách có thể làm mồ côi/đụng đơn online. Chỉ xoá đơn + dữ liệu đơn POS.
--
-- Idempotent: lọc theo điều kiện IN_STORE/'pos'; chạy lại là no-op.

-- Điều kiện nhận diện đơn POS, dùng lại ở mọi bước.
-- (channel/fulfillment_type/source đều được PosOrderService set khi tạo đơn)

-- ── 1. Xoá dữ liệu con trước (tôn trọng khoá ngoại) ───────────────────────────
-- payment_events → payments → orders; order_* children → orders.

DELETE FROM payment_events
 WHERE payment_id IN (
     SELECT p.id FROM payments p
       JOIN orders o ON o.id = p.order_id
      WHERE o.channel = 'IN_STORE' OR o.fulfillment_type = 'IN_STORE' OR o.source = 'pos');

DELETE FROM payments
 WHERE order_id IN (SELECT id FROM orders
                     WHERE channel = 'IN_STORE' OR fulfillment_type = 'IN_STORE' OR source = 'pos');

DELETE FROM order_line_items
 WHERE order_id IN (SELECT id FROM orders
                     WHERE channel = 'IN_STORE' OR fulfillment_type = 'IN_STORE' OR source = 'pos');

DELETE FROM order_notes
 WHERE order_id IN (SELECT id FROM orders
                     WHERE channel = 'IN_STORE' OR fulfillment_type = 'IN_STORE' OR source = 'pos');

DELETE FROM order_addresses
 WHERE order_id IN (SELECT id FROM orders
                     WHERE channel = 'IN_STORE' OR fulfillment_type = 'IN_STORE' OR source = 'pos');

DELETE FROM order_shipping_items
 WHERE order_id IN (SELECT id FROM orders
                     WHERE channel = 'IN_STORE' OR fulfillment_type = 'IN_STORE' OR source = 'pos');

DELETE FROM order_fee_items
 WHERE order_id IN (SELECT id FROM orders
                     WHERE channel = 'IN_STORE' OR fulfillment_type = 'IN_STORE' OR source = 'pos');

-- ── 2. Xoá audit log của hành động tạo đơn POS ────────────────────────────────
DELETE FROM audit_logs WHERE action = 'POS_ORDER_CREATED';

-- ── 3. Xoá chính các đơn POS ──────────────────────────────────────────────────
DELETE FROM orders
 WHERE channel = 'IN_STORE' OR fulfillment_type = 'IN_STORE' OR source = 'pos';

-- ── 4. Gỡ permission pos.* khỏi mọi vai trò ───────────────────────────────────
-- role_permissions là bảng permission-catalog duy nhất (không có bảng `permissions`
-- riêng), nên xoá grant ở đây là retire hẳn các key. pos.refund đã được V261 gỡ.
DELETE FROM role_permissions
 WHERE permission IN ('pos.read', 'pos.write', 'pos.price_override', 'pos.sell_below_cost');
