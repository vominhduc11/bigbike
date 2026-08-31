-- Testcontainers starts from an empty admin_users table, while production migration V1071
-- deliberately verifies the owner-confirmed technical account before retiring DEVELOPER.
-- Seed only the synthetic test equivalent so immutable production migrations can reach the
-- current schema. This file is loaded only by the tc test profile.

INSERT INTO admin_users (
    id,
    email,
    password_hash,
    display_name,
    role,
    status,
    created_at,
    updated_at
) VALUES (
    '10705000-0000-4000-8000-000000000001',
    'vominhduc760@gmail.com',
    NULL,
    'Testcontainers verified admin',
    'DEVELOPER',
    'ACTIVE',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO NOTHING;
