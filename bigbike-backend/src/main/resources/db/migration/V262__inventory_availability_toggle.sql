-- V262: Inventory becomes a boolean "còn hàng / hết hàng" toggle (owner decision 2026-06-23).
--
-- Tồn kho không còn quản lý theo SỐ LƯỢNG. Mỗi biến thể (size/màu) chỉ có công tắc
-- còn hàng / hết hàng (is_available); sản phẩm KHÔNG biến thể có một công tắc duy nhất
-- (stock_state = IN_STOCK / OUT_OF_STOCK). Sản phẩm CÓ biến thể: còn hàng nếu BẤT KỲ
-- biến thể nào còn hàng. Hệ thống không còn trừ kho khi bán, không khôi phục khi huỷ/
-- hoàn, không ghi phiếu nhập/xuất cho việc bán hàng.
--
-- Các cột số lượng (product_variants.quantity_on_hand, products.stock_quantity,
-- products.manage_stock) được GIỮ NGỦ YÊN — không drop để tránh phẫu thuật schema —
-- nhưng không còn được đọc/ghi cho việc xác định còn hàng. Lần backfill này lấy giá trị
-- tồn kho HIỆN TẠI (vẫn phản ánh tồn thật) làm gốc cho công tắc còn/hết.
--
-- (LOW_STOCK giữ trong enum để tương thích nhưng không bao giờ được sinh ra nữa.)

-- ── 1. Variants: a variant is available only if it was available AND had stock on hand ──
UPDATE product_variants
   SET is_available = (is_available AND quantity_on_hand > 0);

UPDATE product_variants
   SET stock_state = CASE WHEN is_available THEN 'IN_STOCK' ELSE 'OUT_OF_STOCK' END;

-- ── 2. No-variant products: availability derived from current stock_quantity ──
UPDATE products p
   SET stock_state = CASE WHEN COALESCE(stock_quantity, 0) > 0 THEN 'IN_STOCK' ELSE 'OUT_OF_STOCK' END
 WHERE NOT EXISTS (
           SELECT 1 FROM product_variants v WHERE v.product_id = p.id
       );

-- ── 3. Products WITH variants: IN_STOCK if any variant is now available ──
UPDATE products p
   SET stock_state = CASE
           WHEN EXISTS (
                   SELECT 1 FROM product_variants v
                    WHERE v.product_id = p.id AND v.is_available = true
                )
           THEN 'IN_STOCK' ELSE 'OUT_OF_STOCK'
       END
 WHERE EXISTS (
           SELECT 1 FROM product_variants v WHERE v.product_id = p.id
       );
