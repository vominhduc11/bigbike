-- ARTICLE_RULE_007/010/011: remove the retired article excerpt and author fields.
-- This is a new forward-only migration. Do not edit the historical migrations that
-- originally introduced these columns.

-- Old article audit snapshots may still expose the retired fields through the admin
-- audit-log response. Prefer JSONB removal so escaped article text is handled safely;
-- keep a best-effort text fallback for any legacy malformed snapshot.
DO $$
DECLARE
    audit_row RECORD;
    cleaned_before TEXT;
    cleaned_after TEXT;
BEGIN
    FOR audit_row IN
        SELECT id, before_data, after_data
        FROM audit_logs
        WHERE resource_type = 'CONTENT'
          AND action LIKE 'CONTENT_ARTICLE_%'
    LOOP
        cleaned_before := audit_row.before_data;
        cleaned_after := audit_row.after_data;

        IF cleaned_before IS NOT NULL THEN
            BEGIN
                cleaned_before := (
                    cleaned_before::jsonb - ARRAY['excerpt', 'excerpt_en', 'authorName', 'authorNameEn']::text[]
                )::text;
            EXCEPTION WHEN OTHERS THEN
                cleaned_before := regexp_replace(
                    regexp_replace(
                        cleaned_before,
                        ',[[:space:]]*"(excerpt|excerpt_en|authorName|authorNameEn)"[[:space:]]*:[[:space:]]*"[^"]*"',
                        '',
                        'g'
                    ),
                    '"(excerpt|excerpt_en|authorName|authorNameEn)"[[:space:]]*:[[:space:]]*"[^"]*"[[:space:]]*,',
                    '',
                    'g'
                );
            END;
        END IF;

        IF cleaned_after IS NOT NULL THEN
            BEGIN
                cleaned_after := (
                    cleaned_after::jsonb - ARRAY['excerpt', 'excerpt_en', 'authorName', 'authorNameEn']::text[]
                )::text;
            EXCEPTION WHEN OTHERS THEN
                cleaned_after := regexp_replace(
                    regexp_replace(
                        cleaned_after,
                        ',[[:space:]]*"(excerpt|excerpt_en|authorName|authorNameEn)"[[:space:]]*:[[:space:]]*"[^"]*"',
                        '',
                        'g'
                    ),
                    '"(excerpt|excerpt_en|authorName|authorNameEn)"[[:space:]]*:[[:space:]]*"[^"]*"[[:space:]]*,',
                    '',
                    'g'
                );
            END;
        END IF;

        UPDATE audit_logs
        SET before_data = cleaned_before,
            after_data = cleaned_after
        WHERE id = audit_row.id;
    END LOOP;
END $$;

ALTER TABLE articles
    DROP COLUMN IF EXISTS excerpt,
    DROP COLUMN IF EXISTS excerpt_en,
    DROP COLUMN IF EXISTS author_name,
    DROP COLUMN IF EXISTS author_name_en;
