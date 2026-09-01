-- Owner decision 2026-08-30: the one-time media reorganization is complete.
-- Keep the folder tree and automatic placement, but remove the unused preview/run history.
-- Drop the detail table first because it references the run table.

DROP TABLE IF EXISTS media_organization_items;
DROP TABLE IF EXISTS media_organization_runs;
