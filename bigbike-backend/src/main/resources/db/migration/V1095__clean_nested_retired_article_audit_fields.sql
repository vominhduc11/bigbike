-- Complete ARTICLE_RULE_001/007/010/011 audit cleanup without changing V1091.
-- Only article audit snapshots are eligible. Retain malformed legacy snapshots
-- byte-for-byte; operators must count/review these before approving deployment.
-- Back up the eligible audit rows privately before applying this data repair.

CREATE OR REPLACE FUNCTION pg_temp.remove_retired_article_audit_keys(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
    cleaned jsonb;
BEGIN
    CASE jsonb_typeof(value)
        WHEN 'object' THEN
            SELECT COALESCE(jsonb_object_agg(entry.key,
                       pg_temp.remove_retired_article_audit_keys(entry.value)), '{}'::jsonb)
            INTO cleaned
            FROM jsonb_each(value) AS entry
            WHERE entry.key <> ALL (ARRAY['excerpt', 'excerpt_en', 'authorName', 'authorNameEn']);
        WHEN 'array' THEN
            SELECT COALESCE(jsonb_agg(pg_temp.remove_retired_article_audit_keys(entry.value)
                                     ORDER BY entry.position), '[]'::jsonb)
            INTO cleaned
            FROM jsonb_array_elements(value) WITH ORDINALITY AS entry(value, position);
        ELSE
            cleaned := value;
    END CASE;
    RETURN cleaned;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.clean_retired_article_audit_snapshot(snapshot text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
    parsed jsonb;
    cleaned jsonb;
BEGIN
    BEGIN
        parsed := snapshot::jsonb;
    EXCEPTION WHEN invalid_text_representation OR untranslatable_character OR numeric_value_out_of_range THEN
        -- Text snapshots can also contain JSON that JSONB cannot represent
        -- (for example escaped NUL or an out-of-range numeric value).
        RETURN snapshot;
    END;
    cleaned := pg_temp.remove_retired_article_audit_keys(parsed);
    -- Avoid rewriting unchanged JSON formatting and unnecessary row locks/WAL.
    IF cleaned IS NOT DISTINCT FROM parsed THEN
        RETURN snapshot;
    END IF;
    RETURN cleaned::text;
END;
$$;

WITH candidates AS MATERIALIZED (
    SELECT id,
           pg_temp.clean_retired_article_audit_snapshot(before_data) AS cleaned_before,
           pg_temp.clean_retired_article_audit_snapshot(after_data) AS cleaned_after
    FROM audit_logs
    WHERE resource_type = 'CONTENT'
      AND starts_with(action, 'CONTENT_ARTICLE_')
)
UPDATE audit_logs AS audit
SET before_data = candidates.cleaned_before,
    after_data = candidates.cleaned_after
FROM candidates
WHERE audit.id = candidates.id
  AND (audit.before_data IS DISTINCT FROM candidates.cleaned_before
       OR audit.after_data IS DISTINCT FROM candidates.cleaned_after);

DROP FUNCTION pg_temp.clean_retired_article_audit_snapshot(text);
DROP FUNCTION pg_temp.remove_retired_article_audit_keys(jsonb);
