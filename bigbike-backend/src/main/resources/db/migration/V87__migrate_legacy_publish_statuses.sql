-- Migrate legacy publish status values to active states.
-- ARCHIVED → HIDDEN (same meaning: not public, but kept)
-- PENDING  → DRAFT  (WP import artifact: unpublished, awaiting edit)
-- PRIVATE  → DRAFT  (WP import artifact: unpublished, awaiting edit)

UPDATE products
SET publish_status = 'HIDDEN'
WHERE publish_status = 'ARCHIVED';

UPDATE products
SET publish_status = 'DRAFT'
WHERE publish_status IN ('PENDING', 'PRIVATE');

UPDATE articles
SET publish_status = 'HIDDEN'
WHERE publish_status = 'ARCHIVED';

UPDATE articles
SET publish_status = 'DRAFT'
WHERE publish_status IN ('PENDING', 'PRIVATE');

UPDATE pages
SET publish_status = 'HIDDEN'
WHERE publish_status = 'ARCHIVED';

UPDATE pages
SET publish_status = 'DRAFT'
WHERE publish_status IN ('PENDING', 'PRIVATE');
