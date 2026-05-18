-- Newsletter opt-in flag for customers.
-- Backs the "Đăng ký nhận tin" checkbox on the account info page.
ALTER TABLE customers
    ADD COLUMN newsletter_subscribed boolean NOT NULL DEFAULT false;
