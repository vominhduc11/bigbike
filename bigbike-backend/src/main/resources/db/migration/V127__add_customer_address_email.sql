-- Per-address contact email for the customer address book.
-- Backs the "Email" field on the address popup.
ALTER TABLE customer_addresses
    ADD COLUMN email varchar(255);
