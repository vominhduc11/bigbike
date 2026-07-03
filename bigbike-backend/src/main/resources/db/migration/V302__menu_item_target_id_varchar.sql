-- Menu items can link straight to a category (target_type='CATEGORY'). Category ids
-- are legacy WP-import strings (e.g. "wp-cat-318" — categories.id is VARCHAR(64)),
-- not UUIDs, so target_id must be a matching varchar column, not uuid.
ALTER TABLE menu_items ALTER COLUMN target_id TYPE VARCHAR(64) USING target_id::text;
