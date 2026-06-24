-- V280: Bài viết Tin tức không còn dùng khối "chú ý" (callout) — đã gỡ khỏi menu thêm khối ở admin.
-- Chuyển các khối callout còn sót trong body_blocks (lớp chỉnh sửa) sang khối đoạn văn thường.
--
-- CHỈ sửa body_blocks; GIỮ NGUYÊN cột body (HTML web đang hiển thị, bản gốc WordPress dạng
-- <blockquote>) để không thay đổi nội dung đang xuất bản. body sẽ được dựng lại từ blocks khi
-- admin lưu lại bài. Sản phẩm (description_blocks) không dùng callout; trang CMS (pages) đã gỡ.
--
-- Idempotent: chỉ chạm các bài còn chứa callout; chạy lại không tác động (đã hết callout).
UPDATE articles a
SET body_blocks = sub.new_blocks
FROM (
  SELECT t.id,
         jsonb_agg(
           CASE WHEN t.elem->>'type' = 'callout'
                THEN (t.elem - 'variant') || '{"type":"paragraph"}'::jsonb
                ELSE t.elem END
           ORDER BY t.ord
         ) AS new_blocks
  FROM (
    SELECT id, elem, ord
    FROM articles, jsonb_array_elements(body_blocks) WITH ORDINALITY AS e(elem, ord)
    WHERE body_blocks @> '[{"type": "callout"}]'::jsonb
  ) t
  GROUP BY t.id
) sub
WHERE a.id = sub.id;
