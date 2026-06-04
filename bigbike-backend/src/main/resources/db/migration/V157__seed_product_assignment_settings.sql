-- Seed editable "Phân công" (team-assignment) guide text for the product create/edit screen.
-- Previously these strings were hardcoded in bigbike-admin i18n (products.detail.assign.*).
-- They now live in site_settings (group 'product_assign', not public) and are SUPER_ADMIN-only
-- writable — enforced by the superAdminOnly flag in SettingDefinitionRegistry + AdminSettingsService.
-- The banner reads them via GET /api/v1/admin/product-assignment (products.read).

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values
    (gen_random_uuid(), 'product_assign_title',         'Phân công', 'product_assign', false, 'Tiêu đề banner phân công trên màn tạo/sửa sản phẩm.', now(), now()),
    (gen_random_uuid(), 'product_assign_role_content',  'Content',   'product_assign', false, 'Tên vai trò 1 (mặc định: Content) trên banner phân công.', now(), now()),
    (gen_random_uuid(), 'product_assign_items_content', 'Thông tin cơ bản · Ảnh đại diện · Bộ sưu tập ảnh · Video · Thông số kỹ thuật · Hướng dẫn lắp đặt · Câu hỏi thường gặp · Biến thể · Sản phẩm liên quan · Nội dung SEO dưới', 'product_assign', false, 'Danh sách công việc do vai trò Content phụ trách.', now(), now()),
    (gen_random_uuid(), 'product_assign_role_seo',      'SEO',       'product_assign', false, 'Tên vai trò 2 (mặc định: SEO) trên banner phân công.', now(), now()),
    (gen_random_uuid(), 'product_assign_items_seo',     'Thông tin SEO (Title, Meta, OG image) · Đường dẫn (slug) · Kiểm tra checklist trước khi đăng', 'product_assign', false, 'Danh sách công việc do vai trò SEO phụ trách.', now(), now()),
    (gen_random_uuid(), 'product_assign_role_manager',  'Quản lý',   'product_assign', false, 'Tên vai trò 3 (mặc định: Quản lý) trên banner phân công.', now(), now()),
    (gen_random_uuid(), 'product_assign_items_manager', 'Giá & trạng thái · Duyệt đăng sản phẩm', 'product_assign', false, 'Danh sách công việc do vai trò Quản lý phụ trách.', now(), now())
on conflict (setting_key) do nothing;
