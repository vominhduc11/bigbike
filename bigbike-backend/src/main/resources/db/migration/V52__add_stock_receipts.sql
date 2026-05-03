-- Phiếu nhập kho: ghi lại mỗi lô hàng nhập về
-- Stock movements sẽ link qua referenceType='RECEIPT', referenceId=stock_receipts.id

CREATE TABLE IF NOT EXISTS stock_receipts (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number   VARCHAR(50)  NOT NULL UNIQUE,
    supplier_name    VARCHAR(255),
    reference_number VARCHAR(100),          -- số hóa đơn / mã vận đơn nhà cung cấp
    note             TEXT,
    admin_id         UUID,
    total_variants   INT          NOT NULL DEFAULT 0,
    total_quantity   INT          NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_created ON stock_receipts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_receipt
    ON stock_movements(reference_type, reference_id)
    WHERE reference_type = 'RECEIPT';
