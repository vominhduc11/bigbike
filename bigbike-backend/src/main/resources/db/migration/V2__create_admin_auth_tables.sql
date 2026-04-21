create table admin_users (
    id uuid primary key,
    email varchar(255) not null,
    password_hash varchar(255) not null,
    display_name varchar(255) not null,
    role varchar(50) not null,
    status varchar(50) not null,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);

create unique index admin_users_email_idx on admin_users(email);

create table admin_refresh_tokens (
    id uuid primary key,
    admin_user_id uuid not null references admin_users(id) on delete cascade,
    token_hash varchar(255) not null,
    expires_at timestamp with time zone not null,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone not null,
    created_by_ip varchar(45),
    user_agent text
);

create unique index admin_refresh_tokens_token_hash_idx on admin_refresh_tokens(token_hash);
create index admin_refresh_tokens_user_id_idx on admin_refresh_tokens(admin_user_id);
create index admin_refresh_tokens_expires_at_idx on admin_refresh_tokens(expires_at);
