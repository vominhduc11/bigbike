-- V372 — Quyền riêng cho thao tác bật/tắt "cho Google hiển thị" (BUSINESS_RULES `SEO_RULE_001`).
--
-- Vì sao tách quyền: trước V371 mọi ô SEO dùng chung đúng một quyền ghi với mọi trường khác
-- (`products.update` / `catalog.update` / `content.update`). Cờ index thì khác hẳn về hậu quả —
-- tắt nhầm một danh mục lớn là mất traffic của cả nhánh, mà không có dấu hiệu gì trên giao diện
-- khách hàng. Owner chốt 2026-08-06: thao tác này cần quyền riêng.
--
-- SUPER_ADMIN không cần dòng nào: role này giữ permission '*'.
-- SHOP_MANAGER CỐ Ý không được cấp — role vận hành bán hàng (có `products.update` để sửa giá,
-- tồn kho, mô tả) nhưng không nắm quyết định hiển thị trên công cụ tìm kiếm.
--
-- Ghi chú: role `SEO_EDITOR` đã bị XOÁ khỏi hệ thống ở V211__reduce_default_roles.sql (chỉ còn
-- token trong enum AdminRole cho bộ nhập WordPress). Không hồi sinh role đó — cấp permission mới
-- trên các role đang sống.

INSERT INTO role_permissions (role_id, permission) VALUES
('ADMIN', 'seo.index'),
('EDITOR', 'seo.index')
ON CONFLICT (role_id, permission) DO NOTHING;
