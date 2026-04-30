-- Add refund tracking columns to orders and payments tables

alter table orders
    add column if not exists refund_amount numeric(19,2) not null default 0,
    add column if not exists refund_reason text,
    add column if not exists refunded_at timestamp with time zone;

alter table payments
    add column if not exists refund_amount numeric(19,2) not null default 0,
    add column if not exists refunded_at timestamp with time zone;

-- Add PARTIALLY_REFUNDED to known payment statuses (doc comment only — stored as varchar)
-- Valid payment statuses: UNPAID, PENDING, PAID, PARTIALLY_PAID, FAILED, REFUNDED, CANCELLED, PARTIALLY_REFUNDED
