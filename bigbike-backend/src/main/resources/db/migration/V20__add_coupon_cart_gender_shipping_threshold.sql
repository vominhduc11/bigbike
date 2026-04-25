-- customer gender and date of birth
alter table customers add column if not exists gender varchar(20);
alter table customers add column if not exists dob date;

-- flexible shipping threshold (free shipping when order >= this amount)
alter table shipping_methods add column if not exists free_shipping_threshold decimal(19, 2);

-- cart coupons (applied coupon codes per cart)
create table if not exists cart_coupons (
    id                uuid primary key,
    cart_id           uuid          not null references carts (id) on delete cascade,
    coupon_code       varchar(100)  not null,
    discount_type     varchar(50)   not null,
    discount_amount   decimal(19,2) not null default 0,
    created_at        timestamp with time zone not null,
    unique (cart_id, coupon_code)
);

create index if not exists idx_cart_coupons_cart_id on cart_coupons (cart_id);
