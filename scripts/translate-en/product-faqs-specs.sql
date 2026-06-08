-- product_faqs
UPDATE product_faqs SET
  question_en = 'Does the LS2 FF800 Storm II meet the latest safety standards?',
  answer_en   = 'Yes. The helmet meets ECE 22.06 (Europe) — the world''s most stringent and up-to-date safety standard — along with Vietnam''s QCVN certification. This ensures optimal protection in both high- and low-speed impacts.'
WHERE id = 31;

UPDATE product_faqs SET
  question_en = 'Does the helmet have an integrated sun visor? Is it anti-fog?',
  answer_en   = 'Yes. The helmet features a dual-visor system: a scratch-resistant, UV-protected polycarbonate outer visor and an internal tinted sun visor. It also comes with a Pinlock 70 MaxVision anti-fog insert, ideal for humid weather conditions.'
WHERE id = 32;

UPDATE product_faqs SET
  question_en = 'Is the helmet heavy? Is it suitable for Asian head shapes?',
  answer_en   = 'The helmet weighs only approximately 1,530g (±50g), making it lightweight for a full-face helmet. The outer shell comes in 3 shell sizes (XS–S / M–L / XL–3XL) with an oval shape, providing a snug and comfortable fit for most Asian users.'
WHERE id = 33;

UPDATE product_faqs SET
  question_en = 'Is the inner liner removable and washable?',
  answer_en   = 'Yes. The liner is made from antibacterial, moisture-wicking material with 3D laser-cut padding. It is fully removable and washable, keeping the helmet fresh and hygienic at all times.'
WHERE id = 34;

-- product_specifications
UPDATE product_specifications SET name_en = 'Weight',         spec_value_en = '3 kg',           group_name_en = 'Specifications' WHERE id = 4;
UPDATE product_specifications SET name_en = 'Dimensions',     spec_value_en = '40 x 70 x 40 cm', group_name_en = 'Specifications' WHERE id = 5;
UPDATE product_specifications SET name_en = 'Shell Material', spec_value_en = 'Carbon Fiber',    group_name_en = 'Specifications' WHERE id = 6;
UPDATE product_specifications SET name_en = 'Safety Standard',spec_value_en = 'ECE/R22-05',      group_name_en = 'Specifications' WHERE id = 7;
UPDATE product_specifications SET name_en = 'Sizes',          spec_value_en = 'M, L, XL, XXL',  group_name_en = 'Specifications' WHERE id = 8;
UPDATE product_specifications SET name_en = 'LS2',
  spec_value_en = 'LS2 is one of the world''s leading helmet brands, renowned for high-quality products.'
WHERE id = 39;
UPDATE product_specifications SET name_en = 'Full Face',
  spec_value_en = 'Full coverage helmet protecting the entire head and chin, offering maximum protection for the rider.'
WHERE id = 40;
UPDATE product_specifications SET name_en = 'ECE 22.06 (Europe) & QCVN (Vietnam)',
  spec_value_en = 'The world''s latest and most stringent safety standard, ensuring superior protection performance.'
WHERE id = 41;
