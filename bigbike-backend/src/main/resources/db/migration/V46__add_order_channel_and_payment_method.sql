alter table orders
    add column if not exists channel varchar(20) not null default 'WEB',
    add column if not exists fulfillment_type varchar(20) not null default 'DELIVERY',
    add column if not exists payment_method varchar(100),
    add column if not exists pending_payment_expires_at timestamp with time zone;

create index if not exists idx_orders_channel on orders (channel);
create index if not exists idx_orders_fulfillment_type on orders (fulfillment_type);
create index if not exists idx_orders_payment_method on orders (payment_method);

-- Partial index for efficient polling of stale SePay ON_HOLD orders
create index if not exists idx_orders_onhold_sepay_placed
    on orders (placed_at)
    where status = 'ON_HOLD' and payment_method = 'SEPAY';

-- Backfill payment_method from payments table (best-effort, non-critical)
update orders o
set payment_method = (
    select p.payment_method
    from payments p
    where p.order_id = o.id
    order by p.created_at
    limit 1
)
where o.payment_method is null;
