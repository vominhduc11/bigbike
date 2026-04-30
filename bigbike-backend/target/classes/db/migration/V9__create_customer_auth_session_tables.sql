create table customer_sessions (
    id uuid primary key,
    customer_id uuid not null references customers (id) on delete cascade,
    session_token_hash varchar(64) not null unique,
    refresh_token_hash varchar(64) unique,
    csrf_token_hash varchar(64),
    status varchar(50) not null default 'ACTIVE',
    user_agent text,
    ip_address varchar(45),
    session_expires_at timestamp with time zone not null,
    refresh_expires_at timestamp with time zone,
    last_active_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create index idx_customer_sessions_customer_id on customer_sessions (customer_id);
create index idx_customer_sessions_session_token_hash on customer_sessions (session_token_hash);
create index idx_customer_sessions_refresh_token_hash on customer_sessions (refresh_token_hash);
create index idx_customer_sessions_status on customer_sessions (status);
create index idx_customer_sessions_session_expires_at on customer_sessions (session_expires_at);

create table customer_password_reset_tokens (
    id uuid primary key,
    customer_id uuid not null references customers (id) on delete cascade,
    token_hash varchar(64) not null unique,
    expires_at timestamp with time zone not null,
    used_at timestamp with time zone,
    created_at timestamp with time zone not null
);

create index idx_customer_pwd_reset_customer_id on customer_password_reset_tokens (customer_id);
create index idx_customer_pwd_reset_token_hash on customer_password_reset_tokens (token_hash);
create index idx_customer_pwd_reset_expires_at on customer_password_reset_tokens (expires_at);

create table customer_email_verification_tokens (
    id uuid primary key,
    customer_id uuid not null references customers (id) on delete cascade,
    token_hash varchar(64) not null unique,
    expires_at timestamp with time zone not null,
    used_at timestamp with time zone,
    created_at timestamp with time zone not null
);

create index idx_customer_email_verify_customer_id on customer_email_verification_tokens (customer_id);
create index idx_customer_email_verify_token_hash on customer_email_verification_tokens (token_hash);
create index idx_customer_email_verify_expires_at on customer_email_verification_tokens (expires_at);
