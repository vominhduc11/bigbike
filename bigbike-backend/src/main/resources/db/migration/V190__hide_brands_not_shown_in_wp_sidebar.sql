-- Ẩn 5 brand không xuất hiện trong sidebar filter của WP live.
-- ALPINESTARS, DRIRIDER, FURYGAN, HJC: brand filter URL không trả kết quả trên WP.
-- HEVIK: sản phẩm tồn tại nhưng brand bị ẩn khỏi layered-nav widget (cấu hình PWB plugin).
-- Mục tiêu: khớp chính xác 14 brand trong sidebar filter như WP live.

UPDATE brands
SET is_visible = false
WHERE slug IN ('alpinestars', 'dririder', 'furygan', 'hevik', 'hjc');
