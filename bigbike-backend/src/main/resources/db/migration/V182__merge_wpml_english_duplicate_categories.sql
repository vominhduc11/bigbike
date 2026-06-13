-- V182: Merge WPML English-duplicate categories into the Vietnamese tree.
--
-- Context:
-- The WordPress site stored each category twice — once in Vietnamese and once
-- in English (WPML), as two SEPARATE terms. The catalog import landed both as
-- distinct rows in `categories`, with the English value in the Vietnamese
-- `name` column and `name_en` left NULL on every row. The result: a parallel
-- English category tree interleaved by sort_order (1 VI, 2 EN, 3 VI, 4 EN…),
-- so the admin list shows Vietnamese and English categories mixed together.
--
-- The migration audit already prescribes the fix:
--   * docs/audits/wp-migration-audit.md (~line 100): "~39 term gồm cả bản dịch
--     tiếng Anh (0 sản phẩm)".
--   * docs/audits/wp-migration-audit.md (~line 268): "Bản dịch English của danh
--     mục… giữ ở mức cột EN, các term EN 0-sản-phẩm bỏ."
--   * docs/engineering/DATA_CONTRACT.md "Category bilingual content (V137)":
--     `name_en` is the canonical English column; storefront/admin resolve the
--     display name via COALESCE(name_en, name).
--
-- So: copy each English term's name into the `name_en` of its Vietnamese
-- counterpart (making the VI/EN toggle actually work), re-home the few products
-- still sitting under an English duplicate, then delete the English duplicates.
--
-- NOT touched — these English-named categories are real accessory brands, not
-- WPML translations, and stay: QUADLOCK (wp-cat-6604), ROK STRAP (wp-cat-6606),
-- KEWIG (wp-cat-6704).
--
-- Idempotent: name_en backfill only fills when still NULL; product re-homing and
-- the deletes are keyed on the English ids, so a second run is a 0-row no-op.

-- 1) Backfill the English name onto its Vietnamese counterpart (only where
--    empty). LEATHER JACKETS & SUIT (wp-cat-6489) has no clear VI counterpart,
--    so it is dropped without a merge — per "term EN 0-sản-phẩm bỏ".
UPDATE categories SET name_en = 'Helmets',             updated_at = now() WHERE id = 'wp-cat-289' AND name_en IS NULL;
UPDATE categories SET name_en = 'Clothing Motorcycle', updated_at = now() WHERE id = 'wp-cat-290' AND name_en IS NULL;
UPDATE categories SET name_en = 'Gloves',              updated_at = now() WHERE id = 'wp-cat-291' AND name_en IS NULL;
UPDATE categories SET name_en = 'Boots',               updated_at = now() WHERE id = 'wp-cat-292' AND name_en IS NULL;
UPDATE categories SET name_en = 'Soft Bag',            updated_at = now() WHERE id = 'wp-cat-294' AND name_en IS NULL;
UPDATE categories SET name_en = 'Fullface',            updated_at = now() WHERE id = 'wp-cat-303' AND name_en IS NULL;
UPDATE categories SET name_en = 'Textile Jacket',      updated_at = now() WHERE id = 'wp-cat-304' AND name_en IS NULL;
UPDATE categories SET name_en = 'Backpacks',           updated_at = now() WHERE id = 'wp-cat-301' AND name_en IS NULL;

-- 2) Re-home products still pointing at an English duplicate (category_id is
--    NOT NULL, so this must run before the deletes).
--    CLOTHING MOTORCYCLE -> ÁO QUẦN BẢO HỘ MOTO PHƯỢT.
UPDATE products SET category_id = 'wp-cat-290', updated_at = now() WHERE category_id = 'wp-cat-6485';

-- 3) Uncategorized bucket — collapse variants into one canonical row.
--    Expected rows: id 'uncategorized' (slug 'uncategorized'), wp-cat-359
--    (slug 'chua-phan-loai'), and optionally wp-cat-6475 (WPML dup).
--    In some DB states the 'uncategorized' row was never created by the importer
--    (ProductCategoryResolver.ensureUncategorized only runs during import), so
--    we INSERT it here if missing. The surviving row MUST keep slug 'uncategorized'
--    so that future re-imports don't recreate an English duplicate.
INSERT INTO categories (id, slug, name, name_en, is_visible, created_at, updated_at)
VALUES ('uncategorized', 'uncategorized', 'Chưa phân loại', 'Uncategorized', false, now(), now())
ON CONFLICT (id) DO UPDATE
    SET name    = EXCLUDED.name,
        name_en = COALESCE(categories.name_en, EXCLUDED.name_en),
        updated_at = now();
UPDATE products SET category_id = 'uncategorized', updated_at = now()
WHERE category_id IN ('wp-cat-359', 'wp-cat-6475');

-- 4) Delete the English-duplicate / superseded rows. Children first to satisfy
--    the self-referential parent_id foreign key, then the roots. wp-cat-359 and
--    wp-cat-6475 are leaves merged into 'uncategorized' above.
DELETE FROM categories WHERE id IN ('wp-cat-6322','wp-cat-6487','wp-cat-6489','wp-cat-6517');
DELETE FROM categories WHERE id IN ('wp-cat-6320','wp-cat-6485','wp-cat-6354','wp-cat-6291','wp-cat-6515','wp-cat-359','wp-cat-6475');
