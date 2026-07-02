-- Drop the optional review title field (added in V234 alongside reviews.photos).
-- reviews.photos (ảnh khách hàng) is untouched.
ALTER TABLE reviews DROP COLUMN title;
