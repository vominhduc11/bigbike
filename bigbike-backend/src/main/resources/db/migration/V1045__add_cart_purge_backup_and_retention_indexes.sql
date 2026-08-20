-- Cart retention is an operational cleanup, never an order/customer/payment cleanup.
-- The backup tables retain a complete copy of each deleted cart run for 90 days.

create table maintenance_cart_purge_runs (
    id uuid primary key default gen_random_uuid(),
    cutoff_at timestamptz not null,
    started_at timestamptz not null default now(),
    completed_at timestamptz,
    status varchar(32) not null,
    carts_purged integer not null default 0,
    items_purged integer not null default 0,
    failure_reason text,
    constraint ck_maintenance_cart_purge_run_status
        check (status in ('RUNNING', 'COMPLETED', 'FAILED', 'RESTORED'))
);

create table maintenance_cart_purge_backup_carts (
    run_id uuid not null references maintenance_cart_purge_runs(id) on delete cascade,
    purged_at timestamptz not null default now(),
    like carts including defaults
);
alter table maintenance_cart_purge_backup_carts
    add primary key (run_id, id);

create table maintenance_cart_purge_backup_items (
    run_id uuid not null references maintenance_cart_purge_runs(id) on delete cascade,
    purged_at timestamptz not null default now(),
    like cart_items including defaults
);
alter table maintenance_cart_purge_backup_items
    add primary key (run_id, id);

create index idx_maintenance_cart_purge_runs_completed_at
    on maintenance_cart_purge_runs(completed_at)
    where completed_at is not null;
create index idx_maintenance_cart_purge_backup_carts_purged_at
    on maintenance_cart_purge_backup_carts(purged_at);
create index idx_maintenance_cart_purge_backup_items_purged_at
    on maintenance_cart_purge_backup_items(purged_at);

-- Các giỏ lịch sử chưa có expires_at dùng lần tương tác đã lưu cuối cùng làm mốc.
-- Không đụng CONVERTED: chúng không thuộc phạm vi lưu giữ hoặc dọn giỏ bỏ quên.
update carts
set expires_at = coalesce(updated_at, created_at) + interval '30 days'
where status in ('ACTIVE', 'MERGED')
  and expires_at is null;

-- The partial index makes the daily expiration scan independent of converted carts.
create index if not exists idx_carts_retention_expiry
    on carts(expires_at, id)
    where status in ('ACTIVE', 'MERGED');
create index if not exists idx_audit_logs_retention_created
    on audit_logs(created_at, id);
