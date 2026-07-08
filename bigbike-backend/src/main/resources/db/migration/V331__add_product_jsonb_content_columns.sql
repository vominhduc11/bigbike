-- faqs/commitments/highlights move from child tables to JSONB columns on products — same physical
-- storage pattern as description_blocks/suitability_section/size_guide_section (V327). V332 migrates
-- the data from the old child tables into these columns; V333 drops the old tables afterward.
ALTER TABLE products ADD COLUMN faqs jsonb;
ALTER TABLE products ADD COLUMN commitments jsonb;
ALTER TABLE products ADD COLUMN highlights jsonb;
