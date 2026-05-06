-- Enforce non-negative cost/amounts on shipping_methods
alter table shipping_methods
    add constraint chk_shipping_methods_cost_non_negative
        check (cost is null or cost >= 0);

alter table shipping_methods
    add constraint chk_shipping_methods_min_order_amount_non_negative
        check (min_order_amount is null or min_order_amount >= 0);

alter table shipping_methods
    add constraint chk_shipping_methods_free_shipping_threshold_non_negative
        check (free_shipping_threshold is null or free_shipping_threshold >= 0);

-- Unique method code per zone (both cod and flat_rate are distinct, no conflict with seed data)
create unique index if not exists uidx_shipping_methods_zone_method_code
    on shipping_methods (zone_id, method_code);
