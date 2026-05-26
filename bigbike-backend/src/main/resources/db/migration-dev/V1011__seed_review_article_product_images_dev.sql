-- Populate product_image_url for the 3 pinned "reviews" experience articles.
-- WP postmeta: product_image attachment IDs 10177, 10180, 10183.
-- PNG files already present in MinIO (verified HTTP 200).
-- These are 500×500 transparent product cut-outs used as the overlay in
-- the homepage "GÓC TRẢI NGHIỆM CÙNG BIGBIKE" carousel.

UPDATE articles
SET product_image_url = 'http://localhost:9000/bigbike-media/wp-uploads/2020/06/LS2-FF352_thumbnail.png',
    product_image_alt = 'Mũ bảo hiểm fullface LS2 FF352',
    updated_at        = now()
WHERE id = 'wp-art-8118'
  AND product_image_url IS NULL;

UPDATE articles
SET product_image_url = 'http://localhost:9000/bigbike-media/wp-uploads/2020/06/avg_thmbnail-1.png',
    product_image_alt = 'Mũ bảo hiểm AGV chính hãng',
    updated_at        = now()
WHERE id = 'wp-art-8110'
  AND product_image_url IS NULL;

UPDATE articles
SET product_image_url = 'http://localhost:9000/bigbike-media/wp-uploads/2020/06/scoyco-jk37_thumbnail-1.png',
    product_image_alt = 'Áo bảo hộ SCOYCO JK37',
    updated_at        = now()
WHERE id = 'wp-art-8078'
  AND product_image_url IS NULL;
