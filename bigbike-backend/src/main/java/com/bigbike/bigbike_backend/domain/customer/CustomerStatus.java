package com.bigbike.bigbike_backend.domain.customer;

/**
 * Authoritative set of customer account statuses stored in the customers.status column.
 * Source of truth: AdminCustomerService.ALLOWED_STATUSES.
 * NOTE: INACTIVE is NOT a valid DB status — it is a computed segment label from deriveSegment().
 */
public enum CustomerStatus {
    ACTIVE,
    DISABLED,
    PENDING,
    BLOCKED
}
