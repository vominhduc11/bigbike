-- Customer avatar (owner decision 2026-07-21): customers may upload one profile
-- photo, stored in MinIO under customers/{customerId}/... . NULL means "no avatar
-- set" — every surface renders a generated initials badge client-side in that case;
-- we deliberately never store a "default avatar" image in MinIO.
ALTER TABLE customers
    ADD COLUMN avatar_url varchar(500);
