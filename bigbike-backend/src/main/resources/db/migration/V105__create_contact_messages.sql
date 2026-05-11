-- V105: Persistent contact / customer-service inbox.
--
-- Replaces fire-and-forget email submission with a tracked inbox so admins
-- can see every customer enquiry, assign it to a teammate, leave internal
-- notes, and mark it resolved. This is Phase 1: single message per record
-- (no thread of replies). A future migration may add a contact_message_replies
-- table for full conversation history.

CREATE TABLE contact_messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name         VARCHAR(255)  NOT NULL,
    phone             VARCHAR(50)   NOT NULL,
    email             VARCHAR(255),
    content           TEXT          NOT NULL,
    status            VARCHAR(20)   NOT NULL DEFAULT 'OPEN',
    admin_note        TEXT,
    assigned_admin_id UUID,
    ip_address        VARCHAR(64),
    user_agent        TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ,
    CONSTRAINT chk_contact_messages_status
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX idx_contact_messages_status_created
    ON contact_messages (status, created_at DESC);

CREATE INDEX idx_contact_messages_assigned
    ON contact_messages (assigned_admin_id);

CREATE INDEX idx_contact_messages_created_at
    ON contact_messages (created_at DESC);

-- Seed new permissions for the contact inbox.
INSERT INTO role_permissions (role_id, permission) VALUES
    ('ADMIN',        'contact.read'),
    ('ADMIN',        'contact.write'),
    ('SHOP_MANAGER', 'contact.read'),
    ('SHOP_MANAGER', 'contact.write')
ON CONFLICT (role_id, permission) DO NOTHING;
