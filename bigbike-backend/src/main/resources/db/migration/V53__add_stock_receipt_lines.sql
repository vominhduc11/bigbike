-- V53: Snapshot dòng phiếu nhập hàng
-- Mục đích: lưu snapshot tại thời điểm nhập để phiếu nhập vẫn đọc đúng sau khi tên/SKU sản phẩm thay đổi.
-- Receipt detail KHÔNG dựa vào live data của product_variants để hiển thị lịch sử nhập.

CREATE TABLE IF NOT EXISTS stock_receipt_lines (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id          UUID         NOT NULL REFERENCES stock_receipts(id) ON DELETE CASCADE,
    product_variant_id  VARCHAR(100) NOT NULL,
    product_name        VARCHAR(255),
    variant_name        VARCHAR(255),
    variant_sku         VARCHAR(100),
    quantity            INT          NOT NULL,
    track_serials       BOOLEAN      NOT NULL DEFAULT FALSE,
    note                TEXT,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipt_lines_receipt ON stock_receipt_lines(receipt_id);
