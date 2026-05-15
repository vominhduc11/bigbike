-- Add CHECK constraints on orders status columns to enforce the validated value sets.
-- Values align with AdminOrderService.ALLOWED_ORDER_STATUSES (V114 simplified payment_status).
-- Existing data has been migrated in V114; constraints are added here as a safety guard.

alter table orders
    add constraint ck_orders_status
        check (status in ('PENDING','PROCESSING','ON_HOLD','COMPLETED','CANCELLED','FAILED','REFUNDED'));

alter table orders
    add constraint ck_orders_payment_status
        check (payment_status in ('UNPAID','PAID','REFUNDED','CANCELLED'));

alter table orders
    add constraint ck_orders_fulfillment_status
        check (fulfillment_status is null
            or fulfillment_status in ('UNFULFILLED','PROCESSING','SHIPPED','DELIVERED','CANCELLED'));
