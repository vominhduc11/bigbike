-- HTML-only SQL/import writes must not leave an obsolete editable block list.
-- The read fallback works immediately; the maintenance task fills the missing blocks.
CREATE OR REPLACE FUNCTION invalidate_stale_article_body_blocks()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.body IS DISTINCT FROM OLD.body
       AND NEW.body_blocks IS NOT DISTINCT FROM OLD.body_blocks THEN
        NEW.body_blocks := NULL;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER articles_invalidate_stale_body_blocks
BEFORE UPDATE OF body ON articles
FOR EACH ROW EXECUTE FUNCTION invalidate_stale_article_body_blocks();
