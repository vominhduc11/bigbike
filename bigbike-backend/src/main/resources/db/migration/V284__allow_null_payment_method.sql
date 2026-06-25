-- V284: Bỏ NOT NULL trên payments.payment_method.
-- Từ V264 (2026-06-23) khách hàng không còn chọn phương thức thanh toán khi đặt online —
-- admin tự đối soát ngoài. Cột payment_method trong orders đã nullable; payments thì chưa,
-- gây lỗi DataIntegrityViolationException khi tạo đơn hàng không có payment method.
ALTER TABLE payments ALTER COLUMN payment_method DROP NOT NULL;
