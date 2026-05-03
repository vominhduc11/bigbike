-- V55: Add serial tracking per stock receipt line.
-- Each serial_number is globally unique (cannot appear twice across all receipts).
-- Replaces the full product_serials lifecycle table removed in V54 with a
-- minimal per-receipt-line table that satisfies the import receipt workflow.

CREATE TABLE stock_receipt_serials (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_line_id UUID        NOT NULL REFERENCES stock_receipt_lines(id) ON DELETE CASCADE,
    serial_number   VARCHAR(100) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_stock_receipt_serial UNIQUE (serial_number)
);

CREATE INDEX idx_receipt_serials_line_id ON stock_receipt_serials(receipt_line_id);
