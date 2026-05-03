-- V57: Serial tracking per stock movement (for manual stock-in without a formal receipt).
-- Serials entered during manual stock-in are linked directly to the stock_movement record.
--
-- TBD: variant-level "requires_serial" flag not yet implemented.
-- Serial is OPTIONAL by default — serial count may be < quantityDelta.
-- When the flag is added, serial count must equal quantityDelta for tracked variants.

CREATE TABLE stock_movement_serials (
    id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_movement_id UUID         NOT NULL REFERENCES stock_movements(id) ON DELETE CASCADE,
    serial_number     VARCHAR(100) NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_movement_serial UNIQUE (serial_number)
);

CREATE INDEX idx_movement_serials_movement ON stock_movement_serials(stock_movement_id);
