-- V34: Add is_active column to sliders table.
-- Required for the admin toggle-active feature. Previously missing from V17.
-- Default true so all existing sliders remain visible after migration.
alter table sliders add column if not exists is_active boolean not null default true;
