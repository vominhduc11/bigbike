-- Backfill logo cho KEWIG và QUADLOCK — hai brand có sản phẩm nhưng logo_url bị null
-- sau khi import WP. Logo tải từ WP live (upload tháng 5/2026) và lưu vào MinIO.

UPDATE brands
SET logo_url = 'https://media.bigbike.vn/bigbike-media/wp-uploads/2026/05/kewig-logo.jpg',
    logo_alt = 'KEWIG'
WHERE slug = 'kewig'
  AND logo_url IS NULL;

UPDATE brands
SET logo_url = 'https://media.bigbike.vn/bigbike-media/wp-uploads/2026/05/quadlock-logo.jpg',
    logo_alt = 'QUADLOCK'
WHERE slug = 'quadlock'
  AND logo_url IS NULL;
