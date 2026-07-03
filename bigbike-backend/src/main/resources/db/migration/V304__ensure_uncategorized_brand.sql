-- V304: Bảo đảm thương hiệu hệ thống "Chưa phân loại" (uncategorized-brand) luôn tồn tại.
--
-- Quyết định nghiệp vụ: xoá vĩnh viễn thương hiệu không chặn khi còn sản phẩm — mọi
-- sản phẩm của thương hiệu bị xoá được tự động chuyển sang thương hiệu "Chưa phân
-- loại" này thay vì để trống, mirror cơ chế danh mục "Chưa phân loại" (V292,
-- CATEGORY_RULE_004) — xem BUSINESS_RULES.md BRAND_RULE_004. Thương hiệu này bị KHOÁ
-- trong admin (không cho sửa/xoá, ẩn khỏi danh sách quản lý) nên buộc phải luôn tồn tại.
--
-- is_visible = false: kho chứa nội bộ, ẩn hoàn toàn khỏi storefront (không trang
-- riêng, không menu/bộ lọc thương hiệu). Trên PDP sản phẩm bên trong không hiện mục
-- thương hiệu nào (JpaCatalogReadRepository.toBrandSummary trả null khi
-- publicView && !isVisible) — admin vẫn thấy tên "Chưa phân loại" trên sản phẩm để
-- biết cần gán lại thương hiệu.

insert into brands (id, slug, name, name_en, is_visible, created_at, updated_at)
values ('uncategorized-brand', 'uncategorized-brand', 'Chưa phân loại', 'Uncategorized', false, now(), now())
on conflict (id) do update
    set name = 'Chưa phân loại',
        name_en = coalesce(brands.name_en, 'Uncategorized'),
        is_visible = false;
