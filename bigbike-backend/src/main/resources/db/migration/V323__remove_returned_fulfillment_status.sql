-- RETURNED removed from the fulfillment status model (owner decision 2026-07-06):
-- the return/refund feature was already gone (see V261), and no admin UI button ever
-- triggered this transition (dead code path). 0 orders currently use RETURNED in this
-- DB, so no data migration is needed — only the CHECK constraint changes.
alter table orders drop constraint if exists ck_orders_fulfillment_status;

alter table orders
    add constraint ck_orders_fulfillment_status
        check (fulfillment_status is null
            or fulfillment_status in ('UNFULFILLED','PROCESSING','SHIPPED','DELIVERED','CANCELLED'));
