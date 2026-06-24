-- V282: Tách ảnh đứng riêng trong khối "đoạn văn" của bài viết thành khối "hình ảnh" đúng cấu trúc.
--
-- Bối cảnh: bài viết WP-import nhét ảnh vào html của khối paragraph thay vì dùng khối image
-- (0 khối image đúng cách trước đó). Với khối paragraph CHỈ chứa đúng 1 ảnh và không có chữ,
-- chuyển thành khối {type:image, url, alt, caption} — url/alt lấy từ thẻ <img> (đã chuẩn hoá /media ở V281).
--
-- GIỮ NGUYÊN: khối paragraph có ảnh LẪN chữ (29 khối) — không tự tách để khỏi vỡ bố cục.
-- Chỉ đổi body_blocks (lớp chỉnh sửa); body (web hiển thị) giữ nguyên. Idempotent.

UPDATE articles a
SET body_blocks = sub.new_blocks
FROM (
  SELECT t.id,
    jsonb_agg(
      CASE
        WHEN t.elem->>'type'='paragraph'
         AND t.elem->>'html' LIKE '%<img%'
         AND regexp_replace(t.elem->>'html','<[^>]+>','','g') !~ '[A-Za-zÀ-ỹ0-9]'
        THEN jsonb_build_object(
               'type','image',
               'url',  substring(t.elem->>'html' from 'src="([^"]+)"'),
               'alt',  coalesce(substring(t.elem->>'html' from 'alt="([^"]*)"'),''),
               'caption','')
        ELSE t.elem
      END
      ORDER BY t.ord
    ) AS new_blocks
  FROM (
    SELECT id, elem, ord
    FROM articles, jsonb_array_elements(body_blocks) WITH ORDINALITY AS e(elem, ord)
    WHERE jsonb_typeof(body_blocks)='array' AND body_blocks::text LIKE '%<img%'
  ) t
  GROUP BY t.id
) sub
WHERE a.id = sub.id
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(a.body_blocks) b
    WHERE b->>'type'='paragraph' AND b->>'html' LIKE '%<img%'
      AND regexp_replace(b->>'html','<[^>]+>','','g') !~ '[A-Za-zÀ-ỹ0-9]'
  );
