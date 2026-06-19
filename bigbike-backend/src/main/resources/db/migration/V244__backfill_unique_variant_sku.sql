-- V244 — PRODUCT_RULE_SKU_001: every variant must have a unique selling SKU.
--
-- 1. Backfill a meaningful SKU for every variant that has none, and regenerate
--    the trailing rows of any existing duplicate group, so all variant SKUs become
--    globally unique (case-insensitive).
-- 2. Add a partial unique index enforcing that uniqueness going forward.
--
-- Generated SKU = <product code or slug abbrev> '-' <option values, accent-stripped>,
-- with a numeric suffix (-2, -3 …) appended on collision. Idempotent: a second run
-- finds no null/duplicate rows and the index already exists, so it is a no-op.
-- See docs/business/BUSINESS_RULES.md (PRODUCT_RULE_SKU_001) and
-- docs/engineering/DATA_CONTRACT.md (SKU fields).

-- Session-local accent stripper + alnum-uppercaser (auto-dropped at session end).
CREATE OR REPLACE FUNCTION pg_temp.bb_sku_clean(p text) RETURNS text AS $f$
  SELECT upper(regexp_replace(translate(lower(coalesce(p, '')),
    'àáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ',
    repeat('a',17)||repeat('e',11)||repeat('i',5)||repeat('o',17)||repeat('u',11)||repeat('y',5)||'d'),
  '[^a-z0-9]+', '', 'g'));
$f$ LANGUAGE sql IMMUTABLE;

DO $$
DECLARE
  r        RECORD;
  v_disc   text;
  v_cand   text;
  v_final  text;
  v_n      int;
BEGIN
  CREATE TEMP TABLE _bb_taken (sku_l text PRIMARY KEY) ON COMMIT DROP;

  -- Reserve the SKUs we keep: the first occurrence (by id) of each existing
  -- non-blank SKU. Later occurrences (duplicates) fall through to regeneration.
  INSERT INTO _bb_taken (sku_l)
  SELECT sku_l FROM (
    SELECT lower(btrim(sku)) AS sku_l,
           row_number() OVER (PARTITION BY lower(btrim(sku)) ORDER BY id) AS rn
    FROM product_variants
    WHERE sku IS NOT NULL AND btrim(sku) <> ''
  ) q WHERE rn = 1;

  -- Rows needing a SKU: blank/null, OR a non-first duplicate of an existing SKU.
  FOR r IN
    SELECT v.id, v.sort_order,
           left(coalesce(
                  nullif(pg_temp.bb_sku_clean(p.sku), ''),
                  nullif(left(pg_temp.bb_sku_clean(p.slug), 24), ''),
                  'BB'), 24) AS base,
           (SELECT string_agg(pg_temp.bb_sku_clean(o.option_value), '' ORDER BY o.sort_order)
              FROM product_variant_options o WHERE o.variant_id = v.id) AS disc_raw
    FROM product_variants v
    JOIN products p ON p.id = v.product_id
    WHERE v.sku IS NULL OR btrim(v.sku) = ''
       OR v.id IN (
            SELECT id FROM (
              SELECT id, row_number() OVER (PARTITION BY lower(btrim(sku)) ORDER BY id) AS rn
              FROM product_variants WHERE sku IS NOT NULL AND btrim(sku) <> ''
            ) d WHERE rn > 1)
    ORDER BY v.product_id, v.sort_order, v.id
  LOOP
    v_disc  := coalesce(nullif(r.disc_raw, ''), 'V' || r.sort_order);
    v_cand  := left(r.base || '-' || v_disc, 90);
    v_final := v_cand;
    v_n     := 1;
    WHILE EXISTS (SELECT 1 FROM _bb_taken WHERE sku_l = lower(v_final)) LOOP
      v_n := v_n + 1;
      v_final := left(v_cand, 86) || '-' || v_n;
    END LOOP;
    INSERT INTO _bb_taken (sku_l) VALUES (lower(v_final));
    UPDATE product_variants SET sku = v_final WHERE id = r.id;
  END LOOP;
END $$;

-- Enforce uniqueness going forward (case-insensitive; nulls allowed for safety,
-- though the backfill above leaves none).
CREATE UNIQUE INDEX IF NOT EXISTS ux_product_variants_sku_lower
  ON product_variants (lower(sku)) WHERE sku IS NOT NULL;
