-- Migrate legacy HIDDEN publish status values to DRAFT (owner decision 2026-07-07).
-- HIDDEN is retired as an active/settable state for Product and Content Article — it is no
-- longer a valid target via the admin API/UI (AdminMutationValidators.validatePublishTransition
-- now rejects it with RESERVED_PUBLISH_STATUS, same as ARCHIVED/PENDING/PRIVATE). Every legacy
-- value now escapes to DRAFT only — no more differentiated per-legacy-value target (ARCHIVED
-- used to migrate to HIDDEN in V87; that target no longer exists, so this simplifies to one
-- consistent value). Straight to DRAFT, NOT routed through TRASH — no data loss, records stay
-- editable/visible in the admin list under the Draft filter.
--
-- Note: the `pages` table (also touched by V87) was dropped in
-- V271__drop_pages_and_guide_page.sql and no longer exists, so only products/articles are
-- touched here.

UPDATE products
SET publish_status = 'DRAFT'
WHERE publish_status = 'HIDDEN';

UPDATE articles
SET publish_status = 'DRAFT'
WHERE publish_status = 'HIDDEN';
