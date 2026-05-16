-- V120: Drop the stock receipt schema entirely.
-- Business decision (2026-05-16): the receipt-based receiving workflow is dropped.
-- Các bảng này (tạo ở V52/V53/V55) là schema mồ côi — không có entity / service /
-- controller / UI nào tham chiếu. Nghiệp vụ nhập kho thực tế chạy qua stock_movements
-- (type IN) + stock_movement_serials. Gỡ schema mồ côi để tránh hiểu nhầm vận hành.
-- Tham chiếu: docs/audits/BIGBIKE_MODULE_FEATURE_COMPLETENESS_AUDIT.md (ORPHAN-01).

DROP TABLE IF EXISTS stock_receipt_serials CASCADE;
DROP TABLE IF EXISTS stock_receipt_lines CASCADE;
DROP TABLE IF EXISTS stock_receipts CASCADE;

-- Index tạo ở V52 riêng cho stock movement gắn phiếu nhập (reference_type = 'RECEIPT').
DROP INDEX IF EXISTS idx_stock_movements_receipt;
