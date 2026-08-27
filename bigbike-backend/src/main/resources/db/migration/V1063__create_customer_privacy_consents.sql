-- Immutable evidence for CUSTOMER_RULE_011. Historical customers are intentionally not backfilled.
create table if not exists customer_privacy_consents (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references customers(id) on delete cascade,
    policy_version varchar(32) not null,
    locale varchar(2) not null check (locale in ('vi', 'en')),
    accepted_at timestamptz not null default now(),
    constraint ux_customer_privacy_consents_customer_version unique (customer_id, policy_version)
);

create index if not exists idx_customer_privacy_consents_customer
    on customer_privacy_consents (customer_id);
