-- Admin onboarding by email invite.
-- Admins are created without a password and set their own via a tokenized link;
-- an INVITED user has no password until they accept, so password_hash becomes nullable.
ALTER TABLE admin_users ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE admin_invite_tokens (
    id            UUID         PRIMARY KEY,
    admin_user_id UUID         NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash    VARCHAR(64)  NOT NULL UNIQUE,           -- SHA-256 hex of the raw token; raw token never stored
    expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at       TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_invite_tokens_user ON admin_invite_tokens(admin_user_id);
