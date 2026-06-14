-- Gán "MŨ BẢO HIỂM FULLFACE" (wp-cat-303) làm child của "MŨ BẢO HIỂM" (wp-cat-289).
-- Import WP để wp-cat-303 ở root (parent_id = NULL) mặc dù trên WP gốc nó là
-- danh mục con của MŨ BẢO HIỂM. Fix này khôi phục đúng cây danh mục.

UPDATE categories
SET parent_id = 'wp-cat-289'
WHERE id = 'wp-cat-303'
  AND parent_id IS NULL;
