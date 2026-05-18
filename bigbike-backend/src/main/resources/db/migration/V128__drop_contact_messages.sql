-- Remove the contact-message feature (public contact form + admin contact inbox).
-- Business decision 2026-05-18: the public website no longer exposes a contact form;
-- customers reach the shop through static contact info (hotline/Zalo/Facebook/address).
-- Reverses V105__create_contact_messages.sql.

DROP TABLE IF EXISTS contact_messages;

DELETE FROM role_permissions WHERE permission IN ('contact.read', 'contact.write');
