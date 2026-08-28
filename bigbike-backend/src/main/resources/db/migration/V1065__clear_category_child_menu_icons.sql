-- CATEGORY_RULE_010: menu icons belong to root categories only.
-- Keep root-category icon assignments untouched; the statement is idempotent.
UPDATE categories
SET menu_icon_url = NULL
WHERE parent_id IS NOT NULL
  AND menu_icon_url IS NOT NULL;
