-- V183: Seed English (setting_value_en) for the homepage marketing settings.
--
-- The storefront localizes settings via PublicSettingsController(lang) +
-- AdminSettingsService.pick(): when lang=en and setting_value_en is non-blank it
-- returns English, otherwise it falls back to the Vietnamese setting_value
-- (PRODUCT_RULE_002 EN-with-Vietnamese-fallback). The setting_value_en column
-- was added in V162; the Vietnamese values were (re)seeded in V94 (about_*,
-- home_content_bottom_html) and V32 (home_exp_*).
--
-- These public_home / homepage marketing rows still had no English, so after a
-- visitor switched the storefront to English the homepage "About" heading +
-- body, the "Experience" block and the bottom SEO content stayed Vietnamese.
-- This fills the English side only; Vietnamese values are left untouched.
--
-- Guarded with "is null or blank" so a value already entered through the admin
-- Settings screen is never overwritten by this migration.

-- About section heading (ACF about_us_0_title) — rendered as the <h3> of the
-- homepage "About BigBike" block.
update site_settings
set    setting_value_en = 'TRUSTED MOTORCYCLE GEAR SHOP',
       updated_at = now()
where  setting_key = 'about_title'
  and  (setting_value_en is null or btrim(setting_value_en) = '');

-- About section body (ACF about_us_0_content).
update site_settings
set    setting_value_en = '<p><span style="font-weight: 400;">Bigbike is proud to be one of the most trusted shops for touring and motorcycle protective gear in Ho Chi Minh City, chosen by countless riders. We specialize in a wide range of motorcycle touring gear, riding accessories and genuine protective equipment from leading brands around the world.</span></p>',
       updated_at = now()
where  setting_key = 'about_content_html'
  and  (setting_value_en is null or btrim(setting_value_en) = '');

-- "Experience" block sub-heading / heading / description.
update site_settings
set    setting_value_en = 'EXPERIENCE CORNER WITH BIGBIKE',
       updated_at = now()
where  setting_key = 'home_exp_subtitle'
  and  (setting_value_en is null or btrim(setting_value_en) = '');

update site_settings
set    setting_value_en = 'PREMIUM MOTORCYCLE TOURING GEAR',
       updated_at = now()
where  setting_key = 'home_exp_title'
  and  (setting_value_en is null or btrim(setting_value_en) = '');

update site_settings
set    setting_value_en = 'At Bigbike, our motorcycle protective gear and touring accessories come in a wide variety of styles and designs at remarkably affordable prices. Our staff know the products inside out and are always ready to advise and take care of customers whenever needed.',
       updated_at = now()
where  setting_key = 'home_exp_desc'
  and  (setting_value_en is null or btrim(setting_value_en) = '');

-- Bottom SEO content block (ACF content_bottom) — rendered visibly at the foot
-- of the homepage. Internal /danh-muc-san-pham/ and /lien-he/ links are kept.
update site_settings
set    setting_value_en = '<h1 style="text-align: justify;"><strong>A motorcycle touring shop specializing in motorcycle touring accessories</strong></h1>
<p style="text-align: justify;"><span style="font-weight: 400;"><strong>Motorcycle protective gear</strong> and <strong>touring accessories</strong> are essential items for big-bike enthusiasts. Their main purpose is to keep riders safe when riding at high speed on long journeys of discovery.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">There are many types of motorcycle protective gear, and each product has its own protective function, such as:</span></p>
<ul style="text-align: justify;">
	<li style="font-weight: 400;"><span style="font-weight: 400;">Helmets: minimise head injuries as much as possible.</span></li>
	<li style="font-weight: 400;"><span style="font-weight: 400;">Protective jackets and trousers: shield the body from impacts while riding.</span></li>
	<li style="font-weight: 400;"><span style="font-weight: 400;">Protective gloves: limit injuries to the hands.</span></li>
	<li style="font-weight: 400;"><span style="font-weight: 400;">Protective boots: improve protection for the feet against hazards.</span></li>
	<li style="font-weight: 400;"><span style="font-weight: 400;">Limb armour, back protectors and armour accessories: help resist impacts and abrasion and enhance protection in unexpected situations.</span></li>
</ul>
<p style="text-align: justify;"><span style="font-weight: 400;">In addition, riders today often equip themselves with many other touring accessories to further protect their bodies. Popular items among riders include rain gear, pinlocks and face masks.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">On top of that, protective gear and touring accessories also help highlight personal style while expressing the strength and confidence of the rider. </span></p>
<h2 style="text-align: justify;"><strong>A motorcycle gear shop that riders can trust</strong></h2>
<p style="text-align: justify;"><span style="font-weight: 400;">When you come to Bigbike, product quality is fully guaranteed. Our products always meet the safety standards required for protective equipment, so you can use them with complete peace of mind. </span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Our </span><a href="/danh-muc-san-pham/non-bao-hiem-moto/"><span style="font-weight: 400;">helmets</span></a><span style="font-weight: 400;">, </span><a href="/danh-muc-san-pham/quan-ao-bao-ho-moto/"><span style="font-weight: 400;">protective jackets and trousers</span></a><span style="font-weight: 400;">, </span><a href="/danh-muc-san-pham/gang-tay/"><span style="font-weight: 400;">gloves</span></a><span style="font-weight: 400;">, </span><a href="/danh-muc-san-pham/giay-bao-ho/"><span style="font-weight: 400;">motorcycle riding boots</span></a><span style="font-weight: 400;"> and </span><a href="/danh-muc-san-pham/phu-kien-khac/"><span style="font-weight: 400;">other touring accessories</span></a><span style="font-weight: 400;"> are supplied by renowned brands such as Taichi, LS2 and Komine, with a wide variety of designs, sizes and colours that give customers plenty of choices. Alongside our commitment to quality, we also guarantee the best prices for our customers. </span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Our shop regularly updates the latest trends and most popular designs on the market, in order to promptly meet customer tastes and needs from basic to advanced. When you visit Bigbike in person, our staff will give you detailed advice and you can check the quality directly to choose the right product for you.</span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Bigbike always listens to and understands customer feedback, and constantly strives to improve so we can bring you the best products and services and become the touring gear shop in Ho Chi Minh City that riders trust. Throughout our growth, we are proud to have earned the trust and the positive reviews of the biker community. </span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">The Bigbike team has deep product knowledge and is always ready to advise whenever needed. Customer satisfaction is always our top priority. </span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">Our after-sales and logistics services are always carried out quickly. Delivery, warranty and product return policies are applied in the most convenient way. Goods are always kept in the best condition during shipping until they reach the customer. </span></p>
<p style="text-align: justify;"><span style="font-weight: 400;">We provide everything you need for your journey. Bigbike is a trusted motorcycle gear shop, worthy of your confidence. Please </span><a href="/lien-he/"><span style="font-weight: 400;">contact</span></a> <span style="font-weight: 400;">our consultants today for more details about our products and to receive attractive special offers.</span></p>',
       updated_at = now()
where  setting_key = 'home_content_bottom_html'
  and  (setting_value_en is null or btrim(setting_value_en) = '');
