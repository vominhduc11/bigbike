-- Rename the two pants size groups so the admin/web filter labels state the
-- measuring system explicitly. V1031 is already applied and must not change;
-- this migration carries the new display labels instead.

UPDATE catalog_size_groups
SET label = 'Cỡ quần (eo inch)',
    label_en = 'Pants (waist inch)'
WHERE group_key = 'pants-waist';

UPDATE catalog_size_groups
SET label = 'Cỡ quần (EU)',
    label_en = 'Pants (EU)'
WHERE group_key = 'pants-eu';
