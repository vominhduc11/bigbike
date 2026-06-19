-- V226: Seed the 'policy' system menu slot + its four CMS-page items.
--
-- Before V225 the storefront's /chinh-sach/{slug} sidebar (and the set of valid
-- policy URLs) was hard-coded in bigbike-web. As of V225 the sidebar is driven
-- by an admin-managed menu at location 'policy' — admins add/remove/reorder
-- items the same way they manage the header/footer menus. Each item points at
-- /chinh-sach/{page-slug}; the page itself is ordinary PAGE content the editor
-- already controls. See MenuLocations.POLICY.
--
-- Idempotent: only inserts rows that do not yet exist, so re-running (or running
-- on a DB where an admin pre-created the menu) is safe.

insert into menus (id, location, name, status, created_at, updated_at)
select '00000000-0000-0000-0000-000000000843',
       'policy',
       'Policy Pages Menu',
       'ACTIVE',
       now(),
       now()
where not exists (select 1 from menus where location = 'policy');

-- Four policy items, mirroring the slugs the storefront previously hard-coded.
-- url = /chinh-sach/{page-slug}; label = VI canonical, label_en = English.
insert into menu_items (id, menu_id, parent_id, label, label_en, url, target_type, target_id,
                        sort_order, open_in_new_tab, css_class, status, created_at, updated_at)
select gen_random_uuid(), m.id, null, v.label, v.label_en, v.url, 'CUSTOM', null,
       v.sort_order, false, null, 'ACTIVE', now(), now()
from menus m
cross join (values
        ('Chính sách bảo mật thông tin', 'Privacy policy', '/chinh-sach/chinh-sach-bao-ve-thong-tin-ca-nhan', 0),
        ('Chính sách bảo hành',          'Warranty policy', '/chinh-sach/chinh-sach-bao-hanh',                 1),
        ('Chính sách đổi trả hàng',      'Return policy',   '/chinh-sach/chinh-sach-doi-tra-hang',            2),
        ('Điều khoản sử dụng',           'Terms of use',    '/chinh-sach/cac-dieu-kien-va-dieu-khoan',        3)
    ) as v(label, label_en, url, sort_order)
where m.location = 'policy'
  and not exists (
        select 1 from menu_items mi
        where mi.menu_id = m.id and mi.url = v.url
  );
