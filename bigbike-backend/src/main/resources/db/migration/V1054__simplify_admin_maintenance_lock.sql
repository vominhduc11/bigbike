-- V1054 — owner decision 2026-08-24: admin maintenance is a binary lock.
--
-- V373, V374 and V375 have already run on the real server and are intentionally
-- left untouched. This migration converts the one known legacy UPCOMING row to
-- NORMAL, removes the display-only expected time, and tightens the database
-- constraint so the removed state cannot be stored again.

UPDATE maintenance_state
SET state = 'NORMAL',
    updated_at = NOW()
WHERE id = 1
  AND state = 'UPCOMING';

-- Defensive cleanup for installations where the V374 setting deletion was not
-- complete. The dedicated table is the only remaining maintenance data source.
DELETE FROM site_settings
WHERE setting_key = 'maintenance_expected_at';

ALTER TABLE maintenance_state
    DROP CONSTRAINT IF EXISTS maintenance_state_state_check;

ALTER TABLE maintenance_state
    ADD CONSTRAINT maintenance_state_state_check
    CHECK (state IN ('NORMAL', 'ACTIVE'));

ALTER TABLE maintenance_state
    DROP COLUMN expected_at;
