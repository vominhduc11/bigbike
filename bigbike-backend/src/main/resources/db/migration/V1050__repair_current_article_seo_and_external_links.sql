-- Repair findings from the live BigBike SEO recrawl on 2026-08-21.
-- SEO_RULE_009: SEO metadata remains plain text; these updates do not introduce markup.
-- Guards preserve later editorial changes if the migration is deployed after an admin edit.

-- The article body identifies this older copy as the SX.100R article and its SEO
-- description already uses that model name. Give it a distinct, evidence-based SEO title.
UPDATE articles
SET seo_title = 'Nón fullface Nexx SX.100R - Lựa chọn hoàn hảo cho những chuyến đi mô tô',
    updated_at = NOW()
WHERE id = 'wp-art-31022'
  AND publish_status = 'PUBLISHED'
  AND seo_title = 'Nón fullface Nexx SR.100R - Lựa chọn hoàn hảo cho những tay lái xe mô tô';

-- The current published article contains an external Tuổi Trẻ link that returned 502
-- in the audit crawl. Remove only the broken hyperlink and preserve its visible wording.
UPDATE articles
SET body = replace(
        body,
        '<a href="https://dulich.tuoitre.vn/du-lich/phu-nu-co-nen-di-phuot-mot-minh-khong-1239361.htm" target="_blank" rel="nofollow noopener">phái đẹp</a>',
        'phái đẹp'
    ),
    body_en = replace(
        body_en,
        '<a href="https://dulich.tuoitre.vn/du-lich/phu-nu-co-nen-di-phuot-mot-minh-khong-1239361.htm" target="_blank" rel="nofollow noopener">women</a>',
        'women'
    ),
    updated_at = NOW()
WHERE id = 'wp-art-25511'
  AND publish_status = 'PUBLISHED'
  AND (
      body LIKE '%https://dulich.tuoitre.vn/du-lich/phu-nu-co-nen-di-phuot-mot-minh-khong-1239361.htm%'
      OR body_en LIKE '%https://dulich.tuoitre.vn/du-lich/phu-nu-co-nen-di-phuot-mot-minh-khong-1239361.htm%'
  );
