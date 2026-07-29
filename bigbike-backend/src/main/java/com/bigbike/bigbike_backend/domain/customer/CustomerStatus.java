package com.bigbike.bigbike_backend.domain.customer;

/**
 * Authoritative set of customer account statuses stored in the customers.status column.
 * AdminCustomerService derives its validation set from this enum.
 * NOTE: INACTIVE is NOT a valid DB status — it is a computed segment label from deriveSegment().
 */
public enum CustomerStatus {
    ACTIVE,
    DISABLED,
    PENDING,
    BLOCKED
}
