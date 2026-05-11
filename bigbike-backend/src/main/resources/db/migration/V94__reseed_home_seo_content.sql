-- V94: Re-seed homepage SEO + about-section settings from the WP source dump
-- (kd_postmeta on wp_posts.ID = 12, the legacy bigbike.vn home page).
--
-- V19 tried to seed these via WHERE NOT EXISTS, but on the current DB those
-- rows are missing (rebuild/restore) and seo_home_title/seo_home_description
-- still hold the V18 ASCII placeholders. This migration uses ON CONFLICT DO
-- UPDATE so it works whether the rows exist with stale/empty values or not.
--
-- Source mapping:
--   _yoast_wpseo_title       → seo_home_title
--   _yoast_wpseo_metadesc    → seo_home_description
--   about_us_0_title         → about_title
--   about_us_0_sub_title     → about_subtitle
--   about_us_0_content       → about_content_html  (URLs rewritten to /danh-muc-san-pham/…)
--   content_bottom           → home_content_bottom_html (URLs rewritten)

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'seo_home_title', E'Shop đồ bảo hộ, đồ phượt moto chuyên cung cấp các phụ kiện đi phượt', 'seo', true, 'Homepage SEO title (Yoast).', now(), now())
on conflict (setting_key) do update
set    setting_value = excluded.setting_value,
       setting_group = excluded.setting_group,
       is_public     = excluded.is_public,
       description   = coalesce(site_settings.description, excluded.description),
       updated_at    = now();

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'seo_home_description', E'Bigbike là shop bảo hộ phượt moto uy tín tại TP HCM. Cửa hàng chuyên cung cấp các sản phẩm đồ bảo hộ và phụ kiện chất lượng chính hãng.', 'seo', true, 'Homepage SEO description (Yoast).', now(), now())
on conflict (setting_key) do update
set    setting_value = excluded.setting_value,
       setting_group = excluded.setting_group,
       is_public     = excluded.is_public,
       description   = coalesce(site_settings.description, excluded.description),
       updated_at    = now();

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'about_title', E'SHOP BẢO HỘ MOTO UY TÍN', 'public_home', true, 'Homepage about section heading (ACF about_us_0_title).', now(), now())
on conflict (setting_key) do update
set    setting_value = excluded.setting_value,
       setting_group = excluded.setting_group,
       is_public     = excluded.is_public,
       description   = coalesce(site_settings.description, excluded.description),
       updated_at    = now();

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'about_subtitle', E'BIGBIKE', 'public_home', true, 'Homepage about section sub-heading (ACF about_us_0_sub_title).', now(), now())
on conflict (setting_key) do update
set    setting_value = excluded.setting_value,
       setting_group = excluded.setting_group,
       is_public     = excluded.is_public,
       description   = coalesce(site_settings.description, excluded.description),
       updated_at    = now();

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'about_content_html', E'<p><span style="font-weight: 400;">Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP HCM được nhiều anh em biker tin tưởng lựa chọn. Chúng tôi chuyên cung cấp đa dạng các dòng sản phẩm đồ phượt moto, phụ kiện phượt, đồ bảo hộ chính hãng từ nhiều thương hiệu nổi tiếng trên thế giới.</span></p>', 'public_home', true, 'Homepage about section body HTML (ACF about_us_0_content).', now(), now())
on conflict (setting_key) do update
set    setting_value = excluded.setting_value,
       setting_group = excluded.setting_group,
       is_public     = excluded.is_public,
       description   = coalesce(site_settings.description, excluded.description),
       updated_at    = now();

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
values (gen_random_uuid(), 'home_content_bottom_html', E'<h1 style="text-align: justify;"><strong>Shop bán đồ phượt moto chuyên cung cấp phụ kiện phượt moto</strong></h1>\n<p style="text-align: justify;"><span style="font-weight: 400;">Các sản phẩm <strong>đồ bảo hộ moto</strong> và <strong>phụ kiện phượt</strong> là những vật dụng không thể thiếu cho các tay chơi phân khối lớn. Các sản phẩm này có chức năng chính là bảo vệ sự an toàn cho các biker khi điều khiển xe moto với tốc độ cao trong các cuộc hành trình khám phá.</span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Có rất nhiều loại đồ bảo hộ moto, mỗi sản phẩm đều sở hữu một tính năng bảo vệ riêng, có thể kể đến như:</span></p>\n<ul style="text-align: justify;">\n	<li style="font-weight: 400;"><span style="font-weight: 400;">Mũ bảo hiểm: giúp giảm thiểu tối đa chấn thương vùng đầu.</span></li>\n	<li style="font-weight: 400;"><span style="font-weight: 400;">Áo quần bảo hộ: bảo vệ cơ thể người mặc khỏi những va đập khi di chuyển.</span></li>\n	<li style="font-weight: 400;"><span style="font-weight: 400;">Găng tay bảo hộ: hạn chế tổn thương vùng tay.</span></li>\n	<li style="font-weight: 400;"><span style="font-weight: 400;">Giày bảo hộ: tăng khả năng bảo vệ chân khỏi nguy hiểm.</span></li>\n	<li style="font-weight: 400;"><span style="font-weight: 400;">Giáp bảo hộ tay chân - đai lưng - phụ kiện giáp: hỗ trợ tăng khả năng chống va đập, mài mòn và nâng cao khả năng bảo vệ người mặc trong những tình huống bất ngờ.</span></li>\n</ul>\n<p style="text-align: justify;"><span style="font-weight: 400;">Bên cạnh đó, các biker hiện nay thường có xu hướng trang bị thêm cho mình nhiều phụ kiện đi phượt moto khác để nâng cao khả năng bảo vệ cho cơ thể. Có nhiều loại sản phẩm đang được các biker ưa chuộng như phụ kiện đi mưa, pinlock và khẩu trang.</span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Ngoài ra, những sản phẩm đồ bảo hộ và phụ kiện đi phượt moto còn góp phần làm nổi bật phong cách và đồng thời thể hiện sự mạnh mẽ cho người sử dụng. </span></p>\n<h2 style="text-align: justify;"><strong>Shop bảo hộ moto đáng tin cậy của các biker</strong></h2>\n<p style="text-align: justify;"><span style="font-weight: 400;">Đến với shop bán đồ phượt moto Bigbike, khách hàng được hoàn toàn đảm bảo về chất lượng sản phẩm. Các sản phẩm luôn đạt được các tiêu chuẩn về độ an toàn dành cho các thiết bị bảo hộ, nên bạn có thể yên tâm khi sử dụng. </span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Các sản phẩm </span><a href="/danh-muc-san-pham/non-bao-hiem-moto/"><span style="font-weight: 400;">mũ bảo hiểm</span></a><span style="font-weight: 400;">, </span><a href="/danh-muc-san-pham/quan-ao-bao-ho-moto/"><span style="font-weight: 400;">quần - áo bảo hộ</span></a><span style="font-weight: 400;">, </span><a href="/danh-muc-san-pham/gang-tay/"><span style="font-weight: 400;">găng tay</span></a><span style="font-weight: 400;">, </span><a href="/danh-muc-san-pham/giay-bao-ho/"><span style="font-weight: 400;">giày bảo hộ moto</span></a><span style="font-weight: 400;"> và </span><a href="/danh-muc-san-pham/phu-kien-khac/"><span style="font-weight: 400;">các phụ kiện đi phượt moto khác</span></a><span style="font-weight: 400;"> được cung cấp bởi những thương hiệu nổi tiếng như </span><span style="font-weight: 400;">Taichi, LS2 và Komine, </span><span style="font-weight: 400;">rất đa dạng về mẫu mã, kích cỡ và màu sắc cho khách hàng nhiều sự lựa chọn khác nhau. Bên cạnh sự cam kết về chất lượng, chúng tôi còn đảm bảo về mức giá tốt nhất cho khách hàng. </span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Những xu hướng và mẫu mã thịnh hành nhất trên thị trường hiện nay luôn được shop đồ bảo hộ moto của chúng tôi cập nhật thường xuyên. Nhằm</span> <span style="font-weight: 400;">đáp ứng kịp thời thị hiếu và nhu cầu từ cơ bản đến nâng cao của khách hàng. Khi đến trực tiếp shop đồ phượt moto của Bigbike, bạn sẽ được nhân viên tư vấn thông tin chi tiết và có thể kiểm tra chất lượng trực tiếp để lựa chọn cho mình sản phẩm phù hợp.</span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Bigbike luôn lắng nghe, thấu hiểu những ý kiến đóng góp của khách hàng và cố gắng hoàn thiện mình để đem đến cho bạn những sản phẩm và dịch vụ tốt nhất và cố gắng trở thành shop đồ phượt Hồ Chí Minh được các anh em biker tin tưởng. Trong suốt quá trình hình thành và phát triển, chúng tôi tự hào là đơn vị nhận được sự tin tưởng cũng như những đánh giá tích cực từ cộng đồng biker. </span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Đội ngũ nhân viên của shop đồ phượt moto Bigbike có sự am hiểu về kiến thức, thông tin sản phẩm và luôn sẵn sàng tư vấn khi cần thiết. Sự hài lòng của khách hàng luôn là tiêu chí hàng đầu của chúng tôi. </span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Những chính sách hậu mãi và dịch vụ hậu cần cũng luôn được thực hiện nhanh chóng. Các hoạt động giao nhận hàng hóa, các chính sách bảo hành và đổi trả sản phẩm luôn được áp dụng tiện lợi nhất. Hàng hóa khi được vận chuyển luôn đảm bảo trạng thái tốt nhất khi đến tay của khách hàng. </span></p>\n<p style="text-align: justify;"><span style="font-weight: 400;">Chúng tôi cung cấp đầy đủ những gì bạn cần cho một cuộc hành trình. Bigbike là shop bảo hộ moto uy tín và xứng đáng để bạn trao gửi niềm tin. Hãy </span><a href="/lien-he/"><span style="font-weight: 400;">liên hệ</span></a>  <span style="font-weight: 400;">ngay với bộ phận tư vấn chúng tôi để biết thêm thông tin chi tiết về các sản phẩm và để được nhận các chương trình ưu đãi hấp dẫn.</span></p>', 'seo', true, 'Homepage bottom SEO content block HTML (ACF content_bottom on WP post 12).', now(), now())
on conflict (setting_key) do update
set    setting_value = excluded.setting_value,
       setting_group = excluded.setting_group,
       is_public     = excluded.is_public,
       description   = coalesce(site_settings.description, excluded.description),
       updated_at    = now();
