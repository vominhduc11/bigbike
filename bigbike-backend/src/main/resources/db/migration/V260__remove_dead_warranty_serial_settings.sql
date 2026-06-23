-- V260: Remove the now-dead warranty-page "serial" copy settings.
--
-- After serial management was removed (V259), the public warranty lookup tool changed from
-- "serial number" to "order number / phone" and renders its input + result-column labels from
-- the web i18n bundle. These 7 public_warranty setting keys are no longer read by anything, so
-- drop them to keep the admin Settings screen clean. (Seeded originally in V225.)

DELETE FROM site_settings WHERE setting_key IN (
    'warranty_page_serial_label',
    'warranty_page_serial_placeholder',
    'warranty_page_serial_hint',
    'warranty_page_field_product',
    'warranty_page_field_serial',
    'warranty_page_field_start',
    'warranty_page_field_end'
);
