-- Dev seed fix: replace cdn.bigbike.local placeholder URLs with real picsum.photos images
-- so product/category/brand/article/slider images render in local dev without MinIO.

-- ───── BRANDS ─────
update brands set
    logo_url  = 'https://picsum.photos/seed/brand-ls2/500/260',
    logo_width = 500, logo_height = 260
where id = 'brand_ls2';

update brands set
    logo_url  = 'https://picsum.photos/seed/brand-kyt/500/260',
    logo_width = 500, logo_height = 260
where id = 'brand_kyt';

-- ───── CATEGORIES ─────
update categories set
    image_url   = 'https://picsum.photos/seed/cat-helmet/1200/800',
    image_width = 1200, image_height = 800
where id = 'cat_helmet';

update categories set
    image_url   = 'https://picsum.photos/seed/cat-jacket/1200/800',
    image_width = 1200, image_height = 800
where id = 'cat_jacket';

-- ───── PRODUCTS (main image) ─────
update products set
    image_url   = 'https://picsum.photos/seed/prod-ls2-ff800/1200/1200',
    image_width = 1200, image_height = 1200
where id = 'prod_ls2_ff800';

update products set
    image_url   = 'https://picsum.photos/seed/prod-kyt-nxrace/1200/1200',
    image_width = 1200, image_height = 1200
where id = 'prod_kyt_nxrace';

update products set
    image_url   = 'https://picsum.photos/seed/prod-ls2-jacket/1200/1200',
    image_width = 1200, image_height = 1200
where id = 'prod_ls2_jacket_city';

-- ───── PRODUCT GALLERY ─────
update product_gallery_images set
    image_url   = 'https://picsum.photos/seed/prod-ls2-ff800-g1/1200/1200',
    image_width = 1200, image_height = 1200
where image_id = 'img_prod_ls2_ff800_1';

update product_gallery_images set
    image_url   = 'https://picsum.photos/seed/prod-ls2-ff800-g2/1200/1200',
    image_width = 1200, image_height = 1200
where image_id = 'img_prod_ls2_ff800_2';

-- ───── ARTICLES ─────
update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-chon-mu/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_chon_mu_fullface';

update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-xu-huong/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_xu_huong_gear_2026';

update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-scs-s9xm/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_trai_nghiem_scs_s9xm';

update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-ls2-garda/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_trai_nghiem_ls2_garda';

update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-ilm-jc08/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_trai_nghiem_ilm_jc08';

update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-blog-baohO/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_blog_chon_bao_ho';

update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-blog-xu-huong/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_blog_xu_huong_2026';

update articles set
    cover_image_url   = 'https://picsum.photos/seed/article-blog-bao-duong/1600/900',
    cover_image_width = 1600, cover_image_height = 900
where id = 'article_blog_bao_duong_mu';

-- ───── HOME SLIDERS ─────
update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-0-desktop/1920/720","alt":"SCS S9XM intercom","width":1920,"height":720}',
    mobile_image  = '{"url":"https://picsum.photos/seed/slider-0-mobile/768/960","alt":"SCS S9XM intercom","width":768,"height":960}'
where id = 'slider_home_0';

update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-1-desktop/1920/720","alt":"ILM Racing MF509","width":1920,"height":720}',
    mobile_image  = '{"url":"https://picsum.photos/seed/slider-1-mobile/768/960","alt":"ILM Racing MF509","width":768,"height":960}'
where id = 'slider_home_1';

update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-2-desktop/1920/720","alt":"ILM JC08 gloves","width":1920,"height":720}',
    mobile_image  = null
where id = 'slider_home_2';

update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-3-desktop/1920/720","alt":"LS2 Garda Air","width":1920,"height":720}',
    mobile_image  = '{"url":"https://picsum.photos/seed/slider-3-mobile/768/960","alt":"LS2 Garda Air","width":768,"height":960}'
where id = 'slider_home_3';

update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-4-desktop/1920/720","alt":"SCS S9X","width":1920,"height":720}',
    mobile_image  = '{"url":"https://picsum.photos/seed/slider-4-mobile/768/960","alt":"SCS S9X","width":768,"height":960}'
where id = 'slider_home_4';

update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-5-desktop/1920/720","alt":"SCS S7X","width":1920,"height":720}',
    mobile_image  = '{"url":"https://picsum.photos/seed/slider-5-mobile/768/960","alt":"SCS S7X","width":768,"height":960}'
where id = 'slider_home_5';

update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-6-desktop/1920/720","alt":"ADV Spyke Sahara","width":1920,"height":720}',
    mobile_image  = '{"url":"https://picsum.photos/seed/slider-6-mobile/768/960","alt":"ADV Spyke Sahara","width":768,"height":960}'
where id = 'slider_home_6';

update sliders set
    desktop_image = '{"url":"https://picsum.photos/seed/slider-7-desktop/1920/720","alt":"Tai nghe Bluetooth SCS","width":1920,"height":720}',
    mobile_image  = '{"url":"https://picsum.photos/seed/slider-7-mobile/768/960","alt":"Tai nghe Bluetooth SCS","width":768,"height":960}'
where id = 'slider_home_7';
