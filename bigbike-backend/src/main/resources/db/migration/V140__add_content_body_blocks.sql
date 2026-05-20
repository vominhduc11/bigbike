ALTER TABLE articles ADD COLUMN IF NOT EXISTS body_blocks jsonb;
ALTER TABLE pages    ADD COLUMN IF NOT EXISTS body_blocks jsonb;
