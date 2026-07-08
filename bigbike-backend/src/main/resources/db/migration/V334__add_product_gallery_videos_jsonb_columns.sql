-- gallery/videos move from child tables to JSONB columns on products — same physical
-- storage pattern as faqs/commitments/highlights (V331). V335 migrates the data from
-- the old child tables into these columns; V336 drops the old tables afterward.
ALTER TABLE products ADD COLUMN gallery jsonb;
ALTER TABLE products ADD COLUMN videos jsonb;
