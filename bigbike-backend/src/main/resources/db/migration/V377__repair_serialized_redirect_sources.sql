-- A historical WordPress import persisted the complete PHP-serialized RankMath
-- `sources` value into redirects.source_pattern. Those rows can never match the
-- pathname sent by the storefront proxy. Expand every exact pattern, keep an
-- already-existing canonical row on conflict, then remove only the serialized
-- rows for which at least one valid exact path was recovered.

CREATE TEMP TABLE redirect_source_repairs AS
WITH parsed AS (
    SELECT
        redirect.id AS original_id,
        redirect.target_url,
        redirect.enabled,
        redirect.hit_count,
        redirect.last_hit_at,
        redirect.notes,
        redirect.legacy_id,
        redirect.created_at,
        redirect.updated_at,
        '/' || ltrim(replace(match[1], '\/', '/'), '/') AS source_path
    FROM redirects redirect
    CROSS JOIN LATERAL regexp_matches(
        redirect.source_pattern,
        's:7:"pattern";s:[0-9]+:"([^"]+)";s:10:"comparison";s:5:"exact";',
        'g'
    ) AS match
    WHERE redirect.source_pattern LIKE 'a:%'
), normalized AS (
    SELECT
        original_id,
        CASE
            WHEN source_path = '/' THEN '/'
            ELSE regexp_replace(source_path, '/+$', '')
        END AS source_pattern,
        target_url,
        enabled,
        hit_count,
        last_hit_at,
        notes,
        legacy_id,
        created_at,
        updated_at
    FROM parsed
    WHERE source_path NOT LIKE '%?%'
      AND source_path NOT LIKE '%#%'
)
SELECT DISTINCT ON (original_id, source_pattern)
    original_id,
    source_pattern,
    target_url,
    enabled,
    hit_count,
    last_hit_at,
    notes,
    legacy_id,
    created_at,
    updated_at
FROM normalized
WHERE source_pattern <> ''
ORDER BY original_id, source_pattern;

INSERT INTO redirects (
    id,
    source_pattern,
    target_url,
    enabled,
    hit_count,
    last_hit_at,
    notes,
    legacy_id,
    created_at,
    updated_at
)
SELECT
    gen_random_uuid(),
    repair.source_pattern,
    repair.target_url,
    repair.enabled,
    repair.hit_count,
    repair.last_hit_at,
    repair.notes,
    repair.legacy_id,
    repair.created_at,
    repair.updated_at
FROM redirect_source_repairs repair
ON CONFLICT (source_pattern) DO NOTHING;

DELETE FROM redirects redirect
WHERE redirect.id IN (
    SELECT DISTINCT repair.original_id
    FROM redirect_source_repairs repair
);

DROP TABLE redirect_source_repairs;
