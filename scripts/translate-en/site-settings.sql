-- site_settings — short text fields
UPDATE site_settings SET setting_value_en = 'BIGBIKE'                                                WHERE setting_key = 'about_subtitle';
UPDATE site_settings SET setting_value_en = 'TRUSTED MOTORCYCLE GEAR SHOP'                           WHERE setting_key = 'about_title';
UPDATE site_settings SET setting_value_en = 'Bigbike.vn specializes in motorcycle protective gear, helmets (full face, flip-up, 3/4, off-road), riding jackets, armored pants, gloves, backpacks, moto bags, and fashion accessories.' WHERE setting_key = 'footer_description';
UPDATE site_settings SET setting_value_en = 'BIGBIKE STRIVES TO LISTEN AND UNDERSTAND YOU BETTER'   WHERE setting_key = 'footer_tagline';
UPDATE site_settings SET setting_value_en = 'Basic Info · Avatar · Photo Gallery · Video · Technical Specs · Installation Guide · FAQs · Variants · Related Products · Bottom SEO Content' WHERE setting_key = 'product_assign_items_content';
UPDATE site_settings SET setting_value_en = 'Price & Status · Product Publishing Approval'           WHERE setting_key = 'product_assign_items_manager';
UPDATE site_settings SET setting_value_en = 'SEO Info (Title, Meta, OG Image) · URL Slug · Pre-publish Checklist' WHERE setting_key = 'product_assign_items_seo';
UPDATE site_settings SET setting_value_en = 'Content'                                                WHERE setting_key = 'product_assign_role_content';
UPDATE site_settings SET setting_value_en = 'Manager'                                                WHERE setting_key = 'product_assign_role_manager';
UPDATE site_settings SET setting_value_en = 'SEO'                                                    WHERE setting_key = 'product_assign_role_seo';
UPDATE site_settings SET setting_value_en = 'Assignment 1'                                           WHERE setting_key = 'product_assign_title';
UPDATE site_settings SET setting_value_en = '20% OFF'                                                WHERE setting_key = 'promo_off';
UPDATE site_settings SET setting_value_en = 'LS2 DUAL SPORT MX436 PIONEER'                          WHERE setting_key = 'promo_title';
UPDATE site_settings SET setting_value_en = 'Bigbike is Ho Chi Minh City''s trusted motorcycle gear shop, specializing in quality protective equipment and accessories from top brands.' WHERE setting_key = 'seo_home_description';
UPDATE site_settings SET setting_value_en = 'Motorcycle Protective Gear Shop — Premium Riding Accessories & Equipment' WHERE setting_key = 'seo_home_title';
UPDATE site_settings SET setting_value_en = 'THE BIGBIKE EXPERIENCE CORNER'                          WHERE setting_key = 'home_exp_subtitle';
UPDATE site_settings SET setting_value_en = 'PREMIUM MOTORCYCLE RIDING ACCESSORIES'                  WHERE setting_key = 'home_exp_title';
UPDATE site_settings SET setting_value_en = 'At Bigbike, our motorcycle protective gear and adventure accessories come in a wide variety of styles and designs at very affordable prices. Our knowledgeable staff is always ready to advise and assist customers whenever needed.' WHERE setting_key = 'home_exp_desc';
-- copy non-translatable values as-is
UPDATE site_settings SET setting_value_en = setting_value WHERE setting_key IN ('hotline','hotline_2','hotline_3','serial_inventory_only','site_name','store_currency','store_timezone','tax_enabled','tax_inclusive','tax_label');

-- about_content_html
UPDATE site_settings SET setting_value_en = $val$<p>Bigbike is proud to be one of the most trusted motorcycle adventure and protective gear shops in Ho Chi Minh City, chosen by countless riders in the biking community. We specialize in a wide range of motorcycle riding products, adventure accessories, and genuine protective gear from world-renowned brands.</p>$val$ WHERE setting_key = 'about_content_html';

-- home_content_bottom_html
UPDATE site_settings SET setting_value_en = $val$<h1 style="text-align: justify;"><strong>Motorcycle Adventure Shop — Your Source for Premium Riding Accessories</strong></h1>
<p style="text-align: justify;"><span style="font-weight: 400;">Motorcycle <strong>protective gear</strong> and <strong>adventure accessories</strong> are essential items for big-bike enthusiasts. Their primary function is to protect riders when operating motorcycles at high speeds during touring adventures.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">There are many types of motorcycle protective gear, each offering its own unique protective function, including:</span></p>
<ul style="text-align: justify;">
        <li style="font-weight: 400;"><span style="font-weight: 400;">Helmet: minimizes head injuries to the greatest possible extent.</span></li>
        <li style="font-weight: 400;"><span style="font-weight: 400;">Riding jacket and pants: protect the body from impacts during riding.</span></li>
        <li style="font-weight: 400;"><span style="font-weight: 400;">Protective gloves: reduce hand and wrist injuries.</span></li>
        <li style="font-weight: 400;"><span style="font-weight: 400;">Protective boots: enhance foot and ankle protection against hazards.</span></li>
        <li style="font-weight: 400;"><span style="font-weight: 400;">Body armor — arm &amp; leg guards, back brace, armor accessories: boost impact resistance, abrasion protection, and overall rider protection in unexpected situations.</span></li>
</ul>
<p style="text-align: justify;"><span style="font-weight: 400;">Additionally, today's bikers often equip themselves with extra adventure accessories to further enhance their protection. Popular choices include rain gear, pinlock visors, and face masks.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Moreover, protective gear and adventure accessories also help riders stand out in style and express their bold, confident personality.</span></p>
<h2 style="text-align: justify;"><strong>Your Trusted Motorcycle Gear Shop</strong></h2>
<p style="text-align: justify;"><span style="font-weight: 400;">At Bigbike, our customers can rest assured about product quality. All products meet the required safety standards for protective equipment, so you can use them with complete confidence.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Our <a href="/danh-muc-san-pham/non-bao-hiem-moto/"><span style="font-weight: 400;">helmets</span></a>, <a href="/danh-muc-san-pham/quan-ao-bao-ho-moto/"><span style="font-weight: 400;">riding jackets and pants</span></a>, <a href="/danh-muc-san-pham/gang-tay/"><span style="font-weight: 400;">gloves</span></a>, <a href="/danh-muc-san-pham/giay-bao-ho/"><span style="font-weight: 400;">motorcycle boots</span></a>, and <a href="/danh-muc-san-pham/phu-kien-khac/"><span style="font-weight: 400;">other riding accessories</span></a> are sourced from renowned brands such as Taichi, LS2, and Komine, available in a wide variety of styles, sizes, and colors. Alongside our quality commitment, we also guarantee the best prices.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Our store keeps up with the latest trends and designs, updating our inventory regularly to meet customers' evolving needs — from basic to advanced. When you visit Bigbike in person, our staff will provide detailed consultation and you can inspect products firsthand to find the perfect fit.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Bigbike always listens to and values customer feedback, continuously improving to deliver the best products and services. We strive to be the most trusted motorcycle gear shop in Ho Chi Minh City for the riding community. Throughout our journey, we are proud to have earned the trust and positive reviews of riders everywhere.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Our team has in-depth product knowledge and is always available to provide expert advice. Customer satisfaction is our top priority.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Our after-sales policies and logistics are always handled swiftly. Delivery, warranty, and return/exchange processes are designed for maximum convenience. All shipments are guaranteed to arrive in perfect condition.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">We provide everything you need for a great journey. Bigbike is a trusted motorcycle gear shop worthy of your confidence. <a href="/lien-he/"><span style="font-weight: 400;">Contact</span></a> our advisory team today to learn more and receive exclusive promotions.</span></p>$val$ WHERE setting_key = 'home_content_bottom_html';
