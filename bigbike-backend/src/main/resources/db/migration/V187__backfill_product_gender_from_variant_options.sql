-- Backfill products.gender từ product_variant_options.
-- V184 thêm cột gender nhưng không populate. Các sản phẩm có variant option
-- name='gender' value='nam'/'nu' được map sang 'Nam'/'Nữ' trên product row.
-- Khi một sản phẩm có nhiều variant với gender khác nhau, lấy giá trị xuất hiện
-- nhiều nhất (DISTINCT ON + COUNT DESC) để tránh xung đột.

UPDATE products p
SET gender = CASE subq.gender_val
                 WHEN 'nam'    THEN 'Nam'
                 WHEN 'nu'     THEN 'Nữ'
                 WHEN 'unisex' THEN 'Unisex'
                 ELSE subq.gender_val
             END
FROM (
    SELECT pv.product_id,
           pvo.option_value                          AS gender_val,
           COUNT(*)                                  AS cnt
    FROM   product_variant_options pvo
    JOIN   product_variants        pv  ON pv.id = pvo.variant_id
    WHERE  pvo.option_name = 'gender'
      AND  pvo.option_value IN ('nam', 'nu', 'unisex')
    GROUP  BY pv.product_id, pvo.option_value
) subq
WHERE p.id     = subq.product_id
  AND p.gender IS NULL;
