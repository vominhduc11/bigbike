-- V360: Backfill category menu icons for categories added after the earlier WP-driven seed.
--
-- The storefront renders category icons from CategoryEntity.menuIconUrl and expects the
-- MinIO-backed public path under /media/uploads/wp-icons/*. These rows were created after the
-- original V219 backfill, so they still have NULL menu icons on some environments.
--
-- Idempotent: only fills blank values and never overwrites an icon that has already been set.

update categories
set    menu_icon_url = case id
           when 'wp-cat-301' then '/media/uploads/wp-icons/icon-7.svg'   -- BALO ĐEO LƯNG
           when 'wp-cat-303' then '/media/uploads/wp-icons/icon-2.svg'   -- FULLFACE
           when 'wp-cat-307' then '/media/uploads/wp-icons/icon-3.svg'   -- ÁO QUẦN ADVENTURE
           when 'wp-cat-309' then '/media/uploads/wp-icons/icon-2.svg'   -- LẬT HÀM - THÁO HÀM
           when 'wp-cat-315' then '/media/uploads/wp-icons/icon-3.svg'   -- ÁO QUẦN MÙA HÈ
           when 'wp-cat-318' then '/media/uploads/wp-icons/icon-2.svg'   -- MŨ 3/4 & 1/2
           when 'wp-cat-319' then '/media/uploads/wp-icons/icon-7.svg'   -- TÚI ĐEO HÔNG - ĐEO ĐÙI
           when 'wp-cat-323' then '/media/uploads/wp-icons/icon-3.svg'   -- ÁO QUẦN TOURING
           when 'wp-cat-324' then '/media/uploads/wp-icons/icon-7.svg'   -- TÚI TREO XE
           when 'wp-cat-325' then '/media/uploads/wp-icons/icon-2.svg'   -- DUAL-SPORT
           when 'cat_120949da94eb419abfc2ca4e6e40b3eb' then '/media/uploads/wp-icons/icon-5.svg'  -- GIÀY MÙA HÈ
           when 'cat_14484a67ac48421c95ffc01bb7e25d09' then '/media/uploads/wp-icons/icon-9.svg'  -- GIÁ ĐỠ ĐIỆN THOẠI
           when 'cat_1a4dee0e836848469be6727355d38a45' then '/media/uploads/wp-icons/icon-9.svg'  -- PHỤ KIỆN CAMERA HÀNH TRÌNH
           when 'cat_70858d3096da4c839e9b636daa7c78be' then '/media/uploads/wp-icons/icon-4.svg'  -- GĂNG TAY MÙA HÈ
           when 'cat_94c62058f135470d97a58b72aa46b781' then '/media/uploads/wp-icons/icon-5.svg'  -- GIÀY TOURING
           when 'cat_b2c11e1679f246c9b12848a90b4955a5' then '/media/uploads/wp-icons/icon-4.svg'  -- GĂNG TAY TOURING
           when 'cat_0155e903984a4a85bea2f9f6d99815d6' then '/media/uploads/wp-icons/icon-10.svg' -- PHỤ KIỆN KHÁC
       end,
       updated_at = now()
where  id in (
           'wp-cat-301',
           'wp-cat-303',
           'wp-cat-307',
           'wp-cat-309',
           'wp-cat-315',
           'wp-cat-318',
           'wp-cat-319',
           'wp-cat-323',
           'wp-cat-324',
           'wp-cat-325',
           'cat_120949da94eb419abfc2ca4e6e40b3eb',
           'cat_14484a67ac48421c95ffc01bb7e25d09',
           'cat_1a4dee0e836848469be6727355d38a45',
           'cat_70858d3096da4c839e9b636daa7c78be',
           'cat_94c62058f135470d97a58b72aa46b781',
           'cat_b2c11e1679f246c9b12848a90b4955a5',
           'cat_0155e903984a4a85bea2f9f6d99815d6'
       )
  and coalesce(btrim(menu_icon_url), '') = '';
