-- V207: Gỡ các ô cấu hình vô tác dụng — không nơi nào trong web/backend đọc tới, điền vào cũng
-- không thay đổi hành vi.
--
--  • Nhóm Thuế (tax_enabled, tax_rate, tax_inclusive, tax_label): checkout LUÔN đặt thuế = 0
--    (CheckoutService: order.setTaxAmount(ZERO) / item.setLineTax(ZERO) cứng), không hề đọc các ô này.
--    Shop không xuất VAT → gỡ cả 4 ô; sau khi xoá, nhóm `tax` không còn dòng nào nên tab "Thuế & Phí"
--    tự biến mất khỏi màn Cài đặt (danh sách tab dựng theo dữ liệu).
--  • order_min_amount: không nơi nào kiểm tra giá trị đơn tối thiểu khi checkout (web lẫn backend).
--
-- Đã gỡ khỏi SettingDefinitionRegistry và nhãn/HIDDEN_KEYS trong màn Cài đặt admin. Cùng hướng đã
-- gỡ các ô không dùng trước đó (V199/V200/V203/V206).

delete from site_settings
where setting_key in ('tax_enabled', 'tax_rate', 'tax_inclusive', 'tax_label', 'order_min_amount');
