-- Repair double-encoded (mojibake) UTF-8 text in migrated tables.
--
-- Root cause: the WordPress SQL dump was UTF-8 but was streamed through
-- an ISO-8859-1 reader, so every multi-byte UTF-8 sequence was treated as
-- individual Latin-1 characters and stored that way in Postgres.
-- Example: "Mũ Bảo Hiểm" was stored as "MÅ©  Báº¢O HIá»M".
--
-- Reversal: convert_from(convert_to(col, 'LATIN1'), 'UTF8')
--   1. convert_to(col, 'LATIN1')  — re-encodes the Postgres UTF-8 text as raw
--      bytes treating each character as a single Latin-1 code point, recovering
--      the original raw byte stream that came from the dump.
--   2. convert_from(..., 'UTF8')  — interprets those bytes as UTF-8, producing
--      the correct Vietnamese text.
--
-- SAFETY: run this ONCE after the first real import. Re-running on already-
-- repaired rows will corrupt the data again. Wrap in a transaction so you
-- can roll back if the result looks wrong.
--
-- Prerequisites:
--   psql -U bigbike -d bigbike -f repair_mojibake.sql
--
-- Verification query (run before and after to compare):
--   SELECT name FROM products LIMIT 5;

BEGIN;

-- ── products ──────────────────────────────────────────────────────────────────
UPDATE products
SET
    name             = convert_from(convert_to(name,             'LATIN1'), 'UTF8'),
    description      = convert_from(convert_to(description,      'LATIN1'), 'UTF8'),
    seo_title        = convert_from(convert_to(seo_title,        'LATIN1'), 'UTF8'),
    seo_description  = convert_from(convert_to(seo_description,  'LATIN1'), 'UTF8')
WHERE
    name            ~ '[À-ÿ]'
    OR description  ~ '[À-ÿ]'
    OR seo_title    ~ '[À-ÿ]'
    OR seo_description ~ '[À-ÿ]';

-- ── articles ──────────────────────────────────────────────────────────────────
UPDATE articles
SET
    title           = convert_from(convert_to(title,           'LATIN1'), 'UTF8'),
    excerpt         = convert_from(convert_to(excerpt,         'LATIN1'), 'UTF8'),
    body            = convert_from(convert_to(body,            'LATIN1'), 'UTF8'),
    seo_title       = convert_from(convert_to(seo_title,       'LATIN1'), 'UTF8'),
    seo_description = convert_from(convert_to(seo_description, 'LATIN1'), 'UTF8')
WHERE
    title           ~ '[À-ÿ]'
    OR excerpt      ~ '[À-ÿ]'
    OR body         ~ '[À-ÿ]'
    OR seo_title    ~ '[À-ÿ]'
    OR seo_description ~ '[À-ÿ]';

-- ── categories ────────────────────────────────────────────────────────────────
UPDATE categories
SET
    name        = convert_from(convert_to(name,        'LATIN1'), 'UTF8'),
    description = convert_from(convert_to(description, 'LATIN1'), 'UTF8')
WHERE
    name        ~ '[À-ÿ]'
    OR description ~ '[À-ÿ]';

-- ── brands ────────────────────────────────────────────────────────────────────
UPDATE brands
SET
    name        = convert_from(convert_to(name,        'LATIN1'), 'UTF8'),
    description = convert_from(convert_to(description, 'LATIN1'), 'UTF8')
WHERE
    name        ~ '[À-ÿ]'
    OR description ~ '[À-ÿ]';

-- ── product_tags ──────────────────────────────────────────────────────────────
UPDATE product_tags
SET tag = convert_from(convert_to(tag, 'LATIN1'), 'UTF8')
WHERE tag ~ '[À-ÿ]';

-- ── pages ─────────────────────────────────────────────────────────────────────
UPDATE pages
SET
    title           = convert_from(convert_to(title,           'LATIN1'), 'UTF8'),
    body            = convert_from(convert_to(body,            'LATIN1'), 'UTF8'),
    seo_title       = convert_from(convert_to(seo_title,       'LATIN1'), 'UTF8'),
    seo_description = convert_from(convert_to(seo_description, 'LATIN1'), 'UTF8')
WHERE
    title           ~ '[À-ÿ]'
    OR body         ~ '[À-ÿ]'
    OR seo_title    ~ '[À-ÿ]'
    OR seo_description ~ '[À-ÿ]';

COMMIT;

-- Post-repair sanity check — should return 0 rows for each table if all fixed:
-- SELECT COUNT(*) FROM products       WHERE name ~ '[À-ÿ]';
-- SELECT COUNT(*) FROM articles       WHERE title ~ '[À-ÿ]';
-- SELECT COUNT(*) FROM categories     WHERE name ~ '[À-ÿ]';
-- SELECT COUNT(*) FROM brands         WHERE name ~ '[À-ÿ]';
-- SELECT COUNT(*) FROM product_tags   WHERE tag ~ '[À-ÿ]';
-- SELECT COUNT(*) FROM pages          WHERE title ~ '[À-ÿ]';
