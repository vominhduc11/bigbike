-- V56: Remove PREORDER stock_state — map all PREORDER rows to OUT_OF_STOCK.
-- ProductStockState enum only supports IN_STOCK, LOW_STOCK, OUT_OF_STOCK.

UPDATE products SET stock_state = 'OUT_OF_STOCK' WHERE stock_state = 'PREORDER';
UPDATE product_variants SET stock_state = 'OUT_OF_STOCK' WHERE stock_state = 'PREORDER';
