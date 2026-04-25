-- V19: Backfill production data for homepage sections and SEO settings.
-- Covers: sliders (8 slides), featured products (3), homepage categories (10),
-- article content-category assignments, and site_settings with real Yoast/ACF values.
-- All INSERT statements are idempotent via WHERE NOT EXISTS (H2 + PostgreSQL compatible).

-- ============================================================
-- 1. SLIDERS — 8 homepage banner slides from WP media library
-- ============================================================
insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_0', 0, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2025/08/tro-chuyen-doi-ket-noi-mai-s9xm-4.jpg","alt":"SCS S9XM Bluetooth Intercom","width":1920,"height":720}',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2025/08/tro-chuyen-doi-ket-noi-mai-s9xm-doc.jpg","alt":"SCS S9XM Bluetooth Intercom","width":768,"height":960}',
    null, '/tai-nghe-bluetooth-gan-mu-bao-hiem.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_0');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_1', 1, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2025/08/csbrdve-1.jpg","alt":"ILM Racing MF509","width":1920,"height":720}',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2025/08/adfgsf-1.jpg","alt":"ILM Racing MF509","width":768,"height":960}',
    null, '/non-bao-hiem-moto.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_1');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_2', 2, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2025/08/jlm-jc08.jpg","alt":"ILM JC08 Gloves","width":1920,"height":720}',
    null,
    null, '/gang-tay.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_2');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_3', 3, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2025/08/ls2-como-vs-garda.jpg","alt":"LS2 Garda Air","width":1920,"height":720}',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2025/08/ls2-como-vs-garda-doc.jpg","alt":"LS2 Garda Air","width":768,"height":960}',
    null, '/non-bao-hiem-moto.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_3');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_4', 4, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2024/10/scs-s9x-scaled.jpg","alt":"SCS S9X Bluetooth","width":1920,"height":720}',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2024/10/scs-s9x-bia-2-scaled.jpg","alt":"SCS S9X Bluetooth","width":768,"height":960}',
    null, '/tai-nghe-bluetooth-gan-mu-bao-hiem.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_4');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_5', 5, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2024/06/scs-s7x-banner-1-scaled.jpg","alt":"SCS S7X Bluetooth","width":1920,"height":720}',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2024/06/scs-s7x-banner-doc-1-1.jpg","alt":"SCS S7X Bluetooth","width":768,"height":960}',
    null, '/tai-nghe-bluetooth-gan-mu-bao-hiem.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_5');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_6', 6, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2023/12/spyke.jpg","alt":"ADV Spyke Sahara","width":1920,"height":720}',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2023/12/spyke2.jpg","alt":"ADV Spyke Sahara","width":768,"height":960}',
    null, '/quan-ao-bao-ho-moto.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_6');

insert into sliders (id, sort_order, location, desktop_image, mobile_image, product_id, external_link, created_at, updated_at)
select 'slider_home_7', 7, 'home',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2023/08/SCS-NEW-03-03-2.png","alt":"Tai nghe Bluetooth SCS gan mu bao hiem","width":1920,"height":720}',
    '{"url":"http://localhost:9000/bigbike-media/wp-uploads/2023/08/SCS-NEW-02-1.png","alt":"Tai nghe Bluetooth SCS gan mu bao hiem","width":768,"height":960}',
    null, '/tai-nghe-bluetooth-gan-mu-bao-hiem.html',
    '2026-04-25T00:00:00Z', '2026-04-25T00:00:00Z'
where not exists (select 1 from sliders where id = 'slider_home_7');

-- ============================================================
-- 2. FEATURED PRODUCTS — 3 tiles on homepage
--    AGV K1S helmet, Komine JK-185 jacket, SCS S9XM bluetooth
-- ============================================================
update products
set    is_featured = true,
       updated_at  = now()
where  id in (
    'wp-prod-41359',  -- AGV K1S helmet
    'wp-prod-41316',  -- Komine JK-185 Enigma G2 WP jacket
    'wp-prod-38469'   -- SCS S9XM bluetooth intercom
)
  and  is_featured is distinct from true;

-- ============================================================
-- 3. HOMEPAGE CATEGORIES — 10 categories with show_on_homepage
--    + sort_order from WP termmeta (show_on_homepage='1')
-- ============================================================
update categories
set    show_on_homepage = true,
       sort_order = case id
           when 'wp-cat-289' then 3
           when 'wp-cat-290' then 8
           when 'wp-cat-291' then 13
           when 'wp-cat-292' then 14
           when 'wp-cat-293' then 15
           when 'wp-cat-294' then 16
           when 'wp-cat-295' then 21
           when 'wp-cat-305' then 22
           when 'wp-cat-299' then 27
           when 'wp-cat-6291' then 0
       end,
       updated_at = now()
where  id in (
    'wp-cat-289',   -- non-bao-hiem-moto
    'wp-cat-290',   -- quan-ao-bao-ho-moto
    'wp-cat-291',   -- gang-tay
    'wp-cat-292',   -- giay-bao-ho
    'wp-cat-293',   -- giap-bao-ho-tay-chan-dai-lung-phu-kien-giap
    'wp-cat-294',   -- balo-deo-lung-tui-deo-tui-treo-xe
    'wp-cat-295',   -- tai-nghe-bluetooth-gan-mu-bao-hiem
    'wp-cat-299',   -- phu-kien-khac
    'wp-cat-305',   -- phu-kien-do-lot
    'wp-cat-6291'   -- boots
);

-- ============================================================
-- 4. ARTICLES — assign content_category_id from WP term_relationships
--    trai-nghiem: WP category 365 (7 posts, IDs 7983–8118)
--    blog: WP category 361 (156 posts, IDs 7973–41300)
-- ============================================================

-- trai-nghiem (WP term 365, 7 posts — likely not yet migrated to articles table)
update articles
set    category_id = 'wp-content-category-365',
       updated_at = now()
where  id in (
    'wp-art-7983', 'wp-art-7990', 'wp-art-8016',
    'wp-art-8073', 'wp-art-8078', 'wp-art-8110', 'wp-art-8118'
)
  and  category_id is distinct from 'wp-content-category-365';

-- blog (WP term 361, 156 posts)
update articles
set    category_id = 'wp-content-category-361',
       updated_at = now()
where  id in (
    'wp-art-7973',  'wp-art-7986',  'wp-art-7988',  'wp-art-8056',
    'wp-art-8060',  'wp-art-8068',  'wp-art-8083',  'wp-art-8088',
    'wp-art-8091',  'wp-art-8102',  'wp-art-8105',  'wp-art-8114',
    'wp-art-8127',  'wp-art-10193', 'wp-art-10201', 'wp-art-10217',
    'wp-art-10228', 'wp-art-10237', 'wp-art-10248', 'wp-art-10253',
    'wp-art-10256', 'wp-art-10259', 'wp-art-10267', 'wp-art-10275',
    'wp-art-10278', 'wp-art-10281', 'wp-art-10288', 'wp-art-10291',
    'wp-art-10294', 'wp-art-10300', 'wp-art-11099', 'wp-art-11112',
    'wp-art-11122', 'wp-art-11130', 'wp-art-11449', 'wp-art-11461',
    'wp-art-11470', 'wp-art-11481', 'wp-art-11871', 'wp-art-11888',
    'wp-art-11896', 'wp-art-11907', 'wp-art-17468', 'wp-art-17526',
    'wp-art-17553', 'wp-art-17619', 'wp-art-25389', 'wp-art-25401',
    'wp-art-25413', 'wp-art-25421', 'wp-art-25467', 'wp-art-25472',
    'wp-art-25486', 'wp-art-25495', 'wp-art-25511', 'wp-art-25521',
    'wp-art-25534', 'wp-art-25541', 'wp-art-25876', 'wp-art-25921',
    'wp-art-25934', 'wp-art-25941', 'wp-art-26069', 'wp-art-26075',
    'wp-art-26095', 'wp-art-27172', 'wp-art-27181', 'wp-art-27254',
    'wp-art-27261', 'wp-art-27577', 'wp-art-27589', 'wp-art-27688',
    'wp-art-27703', 'wp-art-27773', 'wp-art-27786', 'wp-art-28083',
    'wp-art-28091', 'wp-art-28491', 'wp-art-28508', 'wp-art-28647',
    'wp-art-28652', 'wp-art-28708', 'wp-art-28721', 'wp-art-29290',
    'wp-art-29307', 'wp-art-29565', 'wp-art-29579', 'wp-art-29942',
    'wp-art-29965', 'wp-art-30400', 'wp-art-30416', 'wp-art-31018',
    'wp-art-31047', 'wp-art-31053', 'wp-art-31085', 'wp-art-31483',
    'wp-art-31492', 'wp-art-31783', 'wp-art-31801', 'wp-art-32300',
    'wp-art-32305', 'wp-art-32319', 'wp-art-32329', 'wp-art-33849',
    'wp-art-33860', 'wp-art-33867', 'wp-art-33887', 'wp-art-34386',
    'wp-art-34397', 'wp-art-34406', 'wp-art-34418', 'wp-art-34689',
    'wp-art-34705', 'wp-art-34715', 'wp-art-34727', 'wp-art-34908',
    'wp-art-35155', 'wp-art-35165', 'wp-art-35174', 'wp-art-35181',
    'wp-art-35526', 'wp-art-35539', 'wp-art-37093', 'wp-art-37131',
    'wp-art-37138', 'wp-art-37147', 'wp-art-37867', 'wp-art-37876',
    'wp-art-37894', 'wp-art-37910', 'wp-art-37935', 'wp-art-37969',
    'wp-art-38133', 'wp-art-38150', 'wp-art-38159', 'wp-art-38258',
    'wp-art-38353', 'wp-art-38398', 'wp-art-38424', 'wp-art-38441',
    'wp-art-38451', 'wp-art-38465', 'wp-art-38509', 'wp-art-38526',
    'wp-art-38562', 'wp-art-38590', 'wp-art-38726', 'wp-art-38744',
    'wp-art-40775', 'wp-art-40806', 'wp-art-40821', 'wp-art-40868',
    'wp-art-40900', 'wp-art-41028', 'wp-art-41064', 'wp-art-41091',
    'wp-art-41167', 'wp-art-41270', 'wp-art-41300'
)
  and  category_id is distinct from 'wp-content-category-361';

-- ============================================================
-- 5. SITE SETTINGS — real Yoast SEO + ACF about/content values
-- ============================================================

-- 5a. Update existing SEO keys with real Vietnamese content (from WP post 12 Yoast meta)
update site_settings
set    setting_value = 'Shop đồ bảo hộ, đồ phượt moto chuyên cung cấp các phụ kiện đi phượt',
       updated_at = now()
where  setting_key = 'seo_home_title'
  and  setting_value is distinct from 'Shop đồ bảo hộ, đồ phượt moto chuyên cung cấp các phụ kiện đi phượt';

update site_settings
set    setting_value = 'Bigbike là shop bảo hộ phượt moto uy tín tại TP HCM. Cửa hàng chuyên cung cấp các sản phẩm đồ bảo hộ và phụ kiện chất lượng chính hãng.',
       updated_at = now()
where  setting_key = 'seo_home_description'
  and  setting_value is distinct from 'Bigbike là shop bảo hộ phượt moto uy tín tại TP HCM. Cửa hàng chuyên cung cấp các sản phẩm đồ bảo hộ và phụ kiện chất lượng chính hãng.';

-- 5b. Insert new settings keys (about section + content bottom)
insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000510', 'about_title',
       'SHOP BẢO HỘ MOTO UY TÍN',
       'public_home', true, 'Homepage about section heading.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'about_title');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000511', 'about_subtitle',
       'BIGBIKE',
       'public_home', true, 'Homepage about section sub-heading.', now(), now()
where not exists (select 1 from site_settings where setting_key = 'about_subtitle');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000512', 'about_content_html',
       '<p><span style="font-weight: 400">Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP HCM được nhiều anh em biker tin tưởng lựa chọn. Chúng tôi chuyên cung cấp đa dạng các dòng sản phẩm đồ phượt moto, phụ kiện phượt, đồ bảo hộ chính hãng từ nhiều thương hiệu nổi tiếng trên thế giới.</span></p>',
       'public_home', true, 'Homepage about section body HTML (from ACF about_us_0_content).', now(), now()
where not exists (select 1 from site_settings where setting_key = 'about_content_html');

insert into site_settings (id, setting_key, setting_value, setting_group, is_public, description, created_at, updated_at)
select '00000000-0000-0000-0000-000000000513', 'home_content_bottom_html',
       '<h1 style="text-align: justify"><strong>Shop bán đồ phượt moto chuyên cung cấp phụ kiện phượt moto</strong></h1>
<p style="text-align: justify"><span style="font-weight: 400">Các sản phẩm <strong>đồ bảo hộ moto</strong> và <strong>phụ kiện phượt</strong> là những vật dụng không thể thiếu cho các tay chơi phân khối lớn. Các sản phẩm này có chức năng chính là bảo vệ sự an toàn cho các biker khi điều khiển xe moto với tốc độ cao trong các cuộc hành trình khám phá.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Có rất nhiều loại đồ bảo hộ moto, mỗi sản phẩm đều sở hữu một tính năng bảo vệ riêng, có thể kể đến như:</span></p>
<ul style="text-align: justify">
<li style="font-weight: 400"><span style="font-weight: 400">Mũ bảo hiểm: giúp giảm thiểu tối đa chấn thương vùng đầu.</span></li>
<li style="font-weight: 400"><span style="font-weight: 400">Áo quần bảo hộ: bảo vệ cơ thể người mặc khỏi những va đập khi di chuyển.</span></li>
<li style="font-weight: 400"><span style="font-weight: 400">Găng tay bảo hộ: hạn chế tổn thương vùng tay.</span></li>
<li style="font-weight: 400"><span style="font-weight: 400">Giày bảo hộ: tăng khả năng bảo vệ chân khỏi nguy hiểm.</span></li>
<li style="font-weight: 400"><span style="font-weight: 400">Giáp bảo hộ tay chân - đai lưng - phụ kiện giáp: hỗ trợ tăng khả năng chống va đập, mài mòn và nâng cao khả năng bảo vệ người mặc trong những tình huống bất ngờ.</span></li>
</ul>
<p style="text-align: justify"><span style="font-weight: 400">Bên cạnh đó, các biker hiện nay thường có xu hướng trang bị thêm cho mình nhiều phụ kiện đi phượt moto khác để nâng cao khả năng bảo vệ cho cơ thể. Có nhiều loại sản phẩm đang được các biker ưa chuộng như phụ kiện đi mưa, pinlock và khẩu trang.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Ngoài ra, những sản phẩm đồ bảo hộ và phụ kiện đi phượt moto còn góp phần làm nổi bật phong cách và đồng thời thể hiện sự mạnh mẽ cho người sử dụng.</span></p>
<h2 style="text-align: justify"><strong>Shop bảo hộ moto đáng tin cậy của các biker</strong></h2>
<p style="text-align: justify"><span style="font-weight: 400">Đến với shop bán đồ phượt moto Bigbike, khách hàng được hoàn toàn đảm bảo về chất lượng sản phẩm. Các sản phẩm luôn đạt được các tiêu chuẩn về độ an toàn dành cho các thiết bị bảo hộ, nên bạn có thể yên tâm khi sử dụng.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Các sản phẩm </span><a href="/mu-bao-hiem.html"><span style="font-weight: 400">mũ bảo hiểm</span></a><span style="font-weight: 400">, </span><a href="/ao-quan-bao-ho.html"><span style="font-weight: 400">quần - áo bảo hộ</span></a><span style="font-weight: 400">, </span><a href="/gang-tay.html"><span style="font-weight: 400">găng tay</span></a><span style="font-weight: 400">, </span><a href="/giay-bao-ho.html"><span style="font-weight: 400">giày bảo hộ moto</span></a><span style="font-weight: 400"> và </span><a href="/phu-kien-khac.html"><span style="font-weight: 400">các phụ kiện đi phượt moto khác</span></a><span style="font-weight: 400"> được cung cấp bởi những thương hiệu nổi tiếng như Alpinestars, Scoyco và Furygan, rất đa dạng về mẫu mã, kích cỡ và màu sắc cho khách hàng nhiều sự lựa chọn khác nhau. Bên cạnh sự cam kết về chất lượng, chúng tôi còn đảm bảo về mức giá tốt nhất cho khách hàng.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Những xu hướng và mẫu mã thịnh hành nhất trên thị trường hiện nay luôn được shop đồ bảo hộ moto của chúng tôi cập nhật thường xuyên. Nhằm đáp ứng kịp thời thị hiếu và nhu cầu từ cơ bản đến nâng cao của khách hàng. Khi đến trực tiếp shop đồ phượt moto của Bigbike, bạn sẽ được nhân viên tư vấn thông tin chi tiết và có thể kiểm tra chất lượng trực tiếp để lựa chọn cho mình sản phẩm phù hợp.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Bigbike luôn lắng nghe, thấu hiểu những ý kiến đóng góp của khách hàng và cố gắng hoàn thiện mình để đem đến cho bạn những sản phẩm và dịch vụ tốt nhất và cố gắng trở thành shop đồ phượt Hồ Chí Minh được các anh em biker tin tưởng. Trong suốt quá trình hình thành và phát triển, chúng tôi tự hào là đơn vị nhận được sự tin tưởng cũng như những đánh giá tích cực từ cộng đồng biker.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Đội ngũ nhân viên của shop đồ phượt moto Bigbike có sự am hiểu về kiến thức, thông tin sản phẩm và luôn sẵn sàng tư vấn khi cần thiết. Sự hài lòng của khách hàng luôn là tiêu chí hàng đầu của chúng tôi.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Những chính sách hậu mãi và dịch vụ hậu cần cũng luôn được thực hiện nhanh chóng. Các hoạt động giao nhận hàng hóa, các chính sách bảo hành và đổi trả sản phẩm luôn được áp dụng tiện lợi nhất. Hàng hóa khi được vận chuyển luôn đảm bảo trạng thái tốt nhất khi đến tay của khách hàng.</span></p>
<p style="text-align: justify"><span style="font-weight: 400">Chúng tôi cung cấp đầy đủ những gì bạn cần cho một cuộc hành trình. Bigbike là shop bảo hộ moto uy tín và xứng đáng để bạn trao gửi niềm tin. Hãy </span><a href="/lien-he.html"><span style="font-weight: 400">liên hệ</span></a><span style="font-weight: 400"> ngay với bộ phận tư vấn chúng tôi để biết thêm thông tin chi tiết về các sản phẩm và để được nhận các chương trình ưu đãi hấp dẫn.</span></p>',
       'seo', true, 'Homepage bottom SEO content block HTML (from ACF content_bottom, WP post 12).', now(), now()
where not exists (select 1 from site_settings where setting_key = 'home_content_bottom_html');
