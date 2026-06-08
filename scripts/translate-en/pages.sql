-- pages: title, seo_title, seo_description
UPDATE pages SET title_en='How to Find Your Helmet Size', seo_title_en='How to Find Your Correct Helmet Size | BigBike', seo_description_en='Step-by-step guide to measuring your head circumference and reading helmet size charts for full face, 3/4, and flip-up helmets from AGV, LS2, MT, HJC and more.' WHERE id='page_cach_do_size_dau';
UPDATE pages SET title_en='How to Find Your Riding Glove Size', seo_title_en='How to Find Your Correct Riding Glove Size | BigBike', seo_description_en='A detailed guide to measuring your hand to choose the perfectly fitting motorcycle riding gloves — not too tight, not too loose.' WHERE id='page_cach_do_size_gang_tay';
UPDATE pages SET title_en='Warranty Policy', seo_title_en='Product Warranty Policy | BigBike', seo_description_en='BigBike product warranty policy — guaranteed genuine manufacturer warranty of at least 12 months.' WHERE id='page_chinh_sach_bao_hanh';
UPDATE pages SET title_en='Privacy Policy', seo_title_en='Personal Data Privacy Policy | BigBike', seo_description_en='Our commitment to protecting your personal information at BigBike.vn.' WHERE id='page_chinh_sach_bao_mat';
UPDATE pages SET title_en='Return & Exchange Policy', seo_title_en='7-Day Return & Exchange Policy | BigBike', seo_description_en='BigBike 7-day return and exchange policy.' WHERE id='page_chinh_sach_doi_tra';
UPDATE pages SET title_en='Terms & Conditions', seo_title_en='Terms of Use | BigBike.vn', seo_description_en='Terms and conditions of use at BigBike.vn.' WHERE id='page_dieu_khoan';
UPDATE pages SET title_en='About BigBike', seo_title_en='About BigBike — Biker Gear Shop in Ho Chi Minh City', seo_description_en='BigBike — genuine biker protective gear specialist since 2013 in HCMC: helmets, riding jackets, gloves, boots, and rider accessories.' WHERE id='page_gioi_thieu';
UPDATE pages SET title_en='Shopping Guide', seo_title_en='Shopping Guide | BigBike', seo_description_en='Guide to ordering, payment, and delivery at BigBike.vn.' WHERE id='page_huong_dan_mua_hang';
UPDATE pages SET title_en='Contact BigBike', seo_title_en='Contact BigBike', seo_description_en='Contact BigBike via hotline or Zalo.' WHERE id='page_lien_he';

-- pages: body_en
UPDATE pages SET body_en=$b$<p>Choosing the correct helmet size is the most important factor for effective protection and comfortable wear.</p>
<h2>How to Measure Your Head Circumference</h2>
<ol>
<li>Use a soft measuring tape (or a string plus a ruler).</li>
<li>Measure around your head at the <strong>largest point</strong> — approximately 2.5 cm above your eyebrows, passing over the tops of your ears.</li>
<li>Record the measurement in <strong>cm</strong>.</li>
</ol>
<h2>Helmet Size Chart</h2>
<table>
<thead><tr><th>Size</th><th>Head Circumference (cm)</th></tr></thead>
<tbody>
<tr><td>XS</td><td>53 — 54 cm</td></tr>
<tr><td>S</td><td>55 — 56 cm</td></tr>
<tr><td>M</td><td>57 — 58 cm</td></tr>
<tr><td>L</td><td>59 — 60 cm</td></tr>
<tr><td>XL</td><td>61 — 62 cm</td></tr>
<tr><td>XXL</td><td>63 — 64 cm</td></tr>
<tr><td>3XL</td><td>65 — 66 cm</td></tr>
</tbody>
</table>
<h2>Important Notes</h2>
<ul>
<li>A <strong>correctly sized helmet</strong> should fit snugly around your entire head and should not wobble when worn without fastening the chin strap.</li>
<li>New helmets are often slightly tight — after 2–4 hours of use, the liner will break in for a perfect fit.</li>
<li>Head shape — round oval, intermediate oval, or long oval — affects comfort. Consult BigBike to find the right helmet for your head shape.</li>
<li>Always try the helmet on in person if possible, or contact our hotline for advice.</li>
</ul>$b$ WHERE id='page_cach_do_size_dau';

UPDATE pages SET body_en=$b$<p>Choosing the correct glove size ensures better protection and more comfortable riding.</p>
<h2>How to Measure</h2>
<ol>
<li>Use a measuring tape to measure around your hand at the widest point (across the knuckles, excluding the thumb).</li>
<li>Measure in <strong>cm</strong> (or <strong>inches</strong> then convert).</li>
<li>Refer to each brand's size chart — sizing varies between brands.</li>
</ol>
<h2>General Size Reference Chart</h2>
<table>
<thead><tr><th>Size</th><th>Hand Circumference (cm)</th></tr></thead>
<tbody>
<tr><td>XS</td><td>17 — 18 cm</td></tr>
<tr><td>S</td><td>18 — 19 cm</td></tr>
<tr><td>M</td><td>19 — 20 cm</td></tr>
<tr><td>L</td><td>20 — 21 cm</td></tr>
<tr><td>XL</td><td>21 — 22 cm</td></tr>
<tr><td>XXL</td><td>22 — 24 cm</td></tr>
</tbody>
</table>
<h2>Notes</h2>
<ul>
<li>If your measurement falls between two sizes, choose the larger size for comfort.</li>
<li>For winter gloves with thick lining, you may want to go up 0.5 size.</li>
<li>Each brand may have its own size chart — always check on the product page.</li>
</ul>$b$ WHERE id='page_cach_do_size_gang_tay';

UPDATE pages SET body_en=$b$<h2>Warranty Period</h2>
<p>BigBike guarantees product warranty according to each brand's policy, with a minimum of <strong>12 months</strong> from the date of purchase.</p>
<h2>Warranty Coverage</h2>
<ul>
<li>Manufacturing defects (materials, stitching, buckles)</li>
<li>Products that do not meet the quality standards stated on the label</li>
</ul>
<h2>Warranty Exclusions</h2>
<ul>
<li>Normal wear and tear from use</li>
<li>Damage caused by accidents, misuse, or failure to follow instructions</li>
<li>Products that have been self-repaired or structurally modified</li>
</ul>
<h2>Warranty Process</h2>
<ol>
<li>Contact BigBike via hotline <strong>028.62797251</strong> or Zalo <strong>0764640679</strong>.</li>
<li>Provide your purchase receipt and a description of the defect.</li>
<li>Send or bring the product directly to the store: <strong>79/30/52 Au Co, Ward 14, District 11, HCMC</strong>.</li>
<li>BigBike will inspect and process within 5 — 10 business days.</li>
</ol>$b$ WHERE id='page_chinh_sach_bao_hanh';

UPDATE pages SET body_en=$b$<h2>Information We Collect</h2><p>Full name, phone number, email address, delivery address, order history.</p><h2>Privacy Commitment</h2><p>BigBike does not sell or share your personal information with third parties.</p>$b$ WHERE id='page_chinh_sach_bao_mat';

UPDATE pages SET body_en=$b$<h2>Return & Exchange Period</h2><p>BigBike supports returns / exchanges within <strong>7 days</strong> of receiving your order.</p>$b$ WHERE id='page_chinh_sach_doi_tra';

UPDATE pages SET body_en=$b$<p>By using the BigBike.vn website, you agree to the following terms.</p>$b$ WHERE id='page_dieu_khoan';

UPDATE pages SET body_en=$b$<h1>ABOUT BIGBIKE</h1>
<p>BigBike is a genuine motorcycle / biker gear specialist store in Ho Chi Minh City, established in 2013. We are direct distributors of trusted international brands including <strong>LS2, Scoyco, Sena, Alpinestars, Furygan, Helite, AGV, Shark, Shoei, Arai</strong> and many more.</p>
<h2>Our Mission</h2>
<p>Bigbike is proud to be one of the most trusted motorcycle adventure and protective gear shops in HCMC. We are committed to providing <strong>100% genuine</strong> products, dedicated consultation, and thorough after-sales support.</p>
<h2>Why Choose BigBike?</h2>
<ul>
<li><strong>100% Genuine</strong>: All products come with certificates of origin — no counterfeits, no untraceable imports.</li>
<li><strong>Expert Advice</strong>: Our knowledgeable team is ready to help you choose gear that matches your riding style and budget.</li>
<li><strong>Wide Brand Selection</strong>: Over 40 brands from Italy, France, Japan, Korea, and the USA — from entry-level to premium.</li>
<li><strong>Thorough After-Sales</strong>: Genuine manufacturer warranty, size exchange support, usage guides, and product care advice.</li>
</ul>
<h2>Contact Information</h2>
<p><strong>Address</strong>: 79/30/52 Au Co, Ward 14, District 11, Ho Chi Minh City</p>
<p><strong>Hotline</strong>: 028.62797251 — 0764640679 (Mrs. Thu / Zalo) — 0906902404 (Mr. Tri)</p>
<p><strong>Opening Hours</strong>: Mon — Fri: 09:00 — 21:00 | Sat, Sun: 09:00 — 18:00</p>$b$ WHERE id='page_gioi_thieu';

UPDATE pages SET body_en=$b$<h2>Online Shopping</h2><ol><li>Select your product and size.</li><li>Add to cart and proceed to checkout.</li><li>BigBike will confirm your order within 30 minutes — 2 business hours.</li></ol>$b$ WHERE id='page_huong_dan_mua_hang';

UPDATE pages SET body_en=$b$<h2>Store Address</h2><p><strong>79/30/52 Au Co, Ward 14, District 11, HCMC</strong></p><h2>Hotline &amp; Zalo</h2><ul><li><strong>028.62797251</strong> — Switchboard</li><li><strong>0764640679</strong> — Mrs. Thu (Zalo)</li><li><strong>0906902404</strong> — Mr. Tri</li></ul><h2>Opening Hours</h2><table><thead><tr><th>Day</th><th>Hours</th></tr></thead><tbody><tr><td>Mon — Fri</td><td>09:00 — 21:00</td></tr><tr><td>Sat, Sun</td><td>09:00 — 18:00</td></tr></tbody></table><h2>Social Media</h2><ul><li><strong>Facebook</strong>: facebook.com/bigbikegear</li><li><strong>YouTube</strong>: BigBike Vietnam</li></ul><h2>Leave a Message</h2><p>If you need advice outside business hours, message us on <strong>Zalo 0764640679</strong> — we will respond as soon as possible.</p>$b$ WHERE id='page_lien_he';
