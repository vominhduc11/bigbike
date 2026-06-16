-- V218: Fix wrong menu_icon_url backfilled by V217 for "san-pham-khuyen-mai" (Khuyến mãi hot).
--
-- V217 took the icon from the grouped WP CSS rule (dist/home.css):
--   .san-pham-khuyen-mai>a:before,.san-pham-ve-sinh-do-bao-ho-cham-soc-xe>a:before,
--   .tai-nghe-bluetooth-mu-bao-hiem>a:before,.phu-kien-do-lot>a:before{mask-image:url(icon-10.svg)}
-- but missed a later, more specific rule in that same file that overrides icon-10 for this one
-- slug only:
--   .san-pham-khuyen-mai>a:before{mask-image:url(icon-1.png)}
-- Confirmed against the live site (bigbike.vn) computed style: actual mask-image is icon-1.png,
-- not icon-10.svg. icon-1.png is a FontAwesome Brands "hotjar" glyph reused purely for its flame
-- shape to mean "HOT" — kept as a flat PNG (not the icon-1.svg variant) because that svg embeds the
-- glyph as <text font-family="FontAwesome5Brands-Regular"> which only renders correctly with that
-- webfont loaded, which this app does not load.

update categories
set    menu_icon_url = '/wp/icon-1.png',
       updated_at = now()
where  slug = 'san-pham-khuyen-mai';
