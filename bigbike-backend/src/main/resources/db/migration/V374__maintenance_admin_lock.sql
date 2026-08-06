-- V374 — Thu gọn chế độ bảo trì theo quyết định owner 2026-08-06.
--
-- Thay thế thiết kế của V373. Owner chốt lại phạm vi:
--   1. Bảo trì CHỈ áp dụng cho trang quản trị. Storefront không bao giờ có chế độ
--      bảo trì thủ công (BUSINESS_RULES `MAINTENANCE_RULE_001`).
--   2. Khách LUÔN đặt được hàng — công tắc tạm ngưng nhận đơn bị xoá hoàn toàn,
--      kể cả phần chặn ở CheckoutService (`MAINTENANCE_RULE_002`).
--   3. Chỉ tài khoản DEVELOPER riêng được bật/tắt — CỐ Ý không phải SUPER_ADMIN
--      của chủ shop (`MAINTENANCE_RULE_006`, PERMISSION_MATRIX "Maintenance Authority").
--
-- V373 ĐÃ chạy trên production nên đây là migration tiến-tới (forward-only):
-- không sửa V373, mà thu hồi dữ liệu V373 tạo ra rồi dựng cấu trúc mới.
--
-- VÌ SAO TÁCH BẢNG RIÊNG thay vì giữ trong site_settings:
--   AdminSettingsService.listSettings đọc thẳng settingRepo.findAll(), KHÔNG đọc
--   SettingDefinitionRegistry. Nên bỏ key khỏi registry không hề ẩn được dòng đó
--   khỏi màn Cài đặt — mà còn làm mất lớp bảo vệ: requireSuperAdminForRestrictedKey
--   dùng `.orElse(false)`, tức key lạ = KHÔNG hạn chế. Hệ quả: bất kỳ ai có
--   `settings.write` cũng PATCH được maintenance_mode và tự mở khoá, phá thẳng
--   quyết định #3. Ngoài ra ghi giá trị rác vào key này sẽ làm MaintenanceService
--   ném ValidationException ở mọi lần đọc → tự gây sập. Bảng riêng + CHECK
--   constraint loại bỏ cả hai lối này về mặt cấu trúc.

-- ── 1. Bảng trạng thái bảo trì (đúng một dòng, id luôn = 1) ─────────────────
CREATE TABLE maintenance_state (
    id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    state       VARCHAR(16) NOT NULL DEFAULT 'NORMAL'
                CHECK (state IN ('NORMAL', 'UPCOMING', 'ACTIVE')),
    staff_note  TEXT,
    expected_at TIMESTAMP WITH TIME ZONE,
    updated_by  UUID,
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE maintenance_state IS
    'Trạng thái khoá bảo trì trang quản trị. Đúng 1 dòng (id=1). Chỉ role DEVELOPER đổi được.';

INSERT INTO maintenance_state (id, state, updated_at)
VALUES (1, 'NORMAL', NOW())
ON CONFLICT (id) DO NOTHING;

-- ── 2. Thu hồi 5 dòng site_settings do V373 tạo ─────────────────────────────
-- maintenance_notice_enabled / maintenance_orders_paused biến mất hẳn (chỉ phục vụ
-- storefront, nay không còn). 3 key còn lại chuyển sang cột của maintenance_state.
DELETE FROM site_settings
 WHERE setting_key IN (
    'maintenance_mode',
    'maintenance_notice_enabled',
    'maintenance_orders_paused',
    'maintenance_notice_content',
    'maintenance_expected_at'
 );

-- ── 3. Role DEVELOPER ───────────────────────────────────────────────────────
-- is_system = TRUE để AdminRoleService.deleteRole từ chối xoá. Khác mục đích với
-- V211/V361 (gộp/hạ cấp role vận hành) — đây là role kỹ thuật, cố ý tách khỏi
-- SUPER_ADMIN vì quyền '*' của SUPER_ADMIN short-circuit mọi permission check
-- (DevAdminAuthService.hasAnyPermission), nên "chỉ dev" KHÔNG thể biểu diễn bằng
-- permission — bắt buộc phải là cổng so khớp TÊN VAI TRÒ.
INSERT INTO admin_roles (id, name, description, is_system, created_at, updated_at)
VALUES ('DEVELOPER', 'Developer',
        'Tài khoản kỹ thuật: bật/tắt khoá bảo trì trang quản trị. CỐ Ý tách khỏi SUPER_ADMIN.',
        TRUE, NOW(), NOW())
ON CONFLICT (id) DO UPDATE
   SET name        = EXCLUDED.name,
       description = EXCLUDED.description,
       is_system   = TRUE,
       updated_at  = NOW();

-- 34 key liệt kê tường minh, khớp đúng PermissionCatalog.GROUPS.
-- CỐ Ý không dùng "INSERT ... SELECT ... WHERE role_id = 'ADMIN'": ADMIN đang giữ
-- 'seo.index' (cấp ở V372) mà key này thiếu trong PermissionCatalog, nên copy nguyên
-- xi sẽ lây lỗi 400 UNKNOWN_PERMISSION của màn Vai trò sang role thứ ba.
INSERT INTO role_permissions (role_id, permission) VALUES
('DEVELOPER', 'orders.read'),            ('DEVELOPER', 'orders.write'),
('DEVELOPER', 'customers.read'),         ('DEVELOPER', 'customers.write'),
('DEVELOPER', 'reviews.read'),           ('DEVELOPER', 'reviews.write'),
('DEVELOPER', 'reports.read'),           ('DEVELOPER', 'reports.export'),
('DEVELOPER', 'products.read'),          ('DEVELOPER', 'products.update'),
('DEVELOPER', 'catalog.read'),           ('DEVELOPER', 'catalog.update'),
('DEVELOPER', 'inventory.read'),
('DEVELOPER', 'content.read'),           ('DEVELOPER', 'content.update'),
('DEVELOPER', 'media.read'),             ('DEVELOPER', 'media.write'),
('DEVELOPER', 'menus.read'),             ('DEVELOPER', 'menus.write'),
('DEVELOPER', 'sliders.read'),           ('DEVELOPER', 'sliders.write'),
('DEVELOPER', 'home_videos.read'),       ('DEVELOPER', 'home_videos.write'),
('DEVELOPER', 'home_highlights.read'),   ('DEVELOPER', 'home_highlights.write'),
('DEVELOPER', 'redirects.read'),         ('DEVELOPER', 'redirects.write'),
('DEVELOPER', 'settings.read'),          ('DEVELOPER', 'settings.write'),
('DEVELOPER', 'admin-users.read'),       ('DEVELOPER', 'admin-users.write'),
('DEVELOPER', 'roles.read'),             ('DEVELOPER', 'roles.write'),
('DEVELOPER', 'audit-logs.read')
ON CONFLICT (role_id, permission) DO NOTHING;
