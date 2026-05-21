-- V116 constraint omitted 'RETURNED'; the service already allows SHIPPED -> RETURNED
-- and DELIVERED -> RETURNED but any write would hit a CHECK violation.
alter table orders drop constraint if exists ck_orders_fulfillment_status;

alter table orders
    add constraint ck_orders_fulfillment_status
        check (fulfillment_status is null
            or fulfillment_status in ('UNFULFILLED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED'));
