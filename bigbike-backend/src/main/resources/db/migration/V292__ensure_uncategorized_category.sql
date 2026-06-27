-- V292: Bảo đảm danh mục hệ thống "Chưa phân loại" (uncategorized) luôn tồn tại.
--
-- Quyết định nghiệp vụ (2026-06-27): xoá danh mục KHÔNG còn yêu cầu danh mục phải
-- rỗng. Mọi sản phẩm trong danh mục bị xoá (cùng cả cây con) được tự động chuyển
-- sang danh mục "Chưa phân loại" này thay vì chặn thao tác xoá — xem
-- BUSINESS_RULES.md CATEGORY_RULE_004. Danh mục này bị KHOÁ trong admin (không cho
-- đổi tên / xoá) nên buộc phải luôn tồn tại.
--
-- is_visible = false: đây là kho chứa nội bộ, không hiển thị như một danh mục ngoài
-- storefront (menu / lưới danh mục). Sản phẩm bên trong vẫn truy cập / tìm kiếm
-- bình thường. Trước đây slug này chỉ là fallback khi import từ WordPress
-- (ProductCategoryResolver); migration này nâng nó thành danh mục hệ thống chuẩn.

insert into categories (id, slug, name, name_en, is_visible, created_at, updated_at)
values ('uncategorized', 'uncategorized', 'Chưa phân loại', 'Uncategorized', false, now(), now())
on conflict (id) do update
    set name = 'Chưa phân loại',
        name_en = coalesce(categories.name_en, 'Uncategorized'),
        is_visible = false;
