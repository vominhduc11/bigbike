-- Account lockout for the admin login flow (security hardening).
-- After a number of consecutive failed password attempts an account is locked for a
-- cool-down window (enforced in AdminAuthService / AdminLoginAttemptService).
--   failed_login_attempts: running counter, reset to 0 on a successful login or once a lock is applied.
--   locked_until: when set and in the future, login is refused; cleared on a successful login.
ALTER TABLE admin_users
    ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN locked_until timestamp with time zone;
