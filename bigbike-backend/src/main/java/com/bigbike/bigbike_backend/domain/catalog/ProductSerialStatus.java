package com.bigbike.bigbike_backend.domain.catalog;

/**
 * Lifecycle states for a physical serial unit (chassis/engine number).
 * stock_state on variants/products is derived from the count of IN_STOCK serials.
 *
 * Valid transitions (see STATE_MACHINES.md Section 9):
 *   IN_STOCK → RESERVED (checkout reservation)
 *   IN_STOCK → DAMAGED | INSPECTION | SCRAPPED (admin action)
 *   RESERVED → IN_STOCK (TTL expiry / order cancel)
 *   RESERVED → SOLD (order completion)
 *   SOLD → RETURNED (return initiated)
 *   RETURNED → INSPECTION (admin review)
 *   INSPECTION → IN_STOCK | DAMAGED | SCRAPPED (admin decision)
 *   DAMAGED → SCRAPPED (write-off)
 *   Any → Any (admin correction, logged in audit)
 */
public enum ProductSerialStatus {
    IN_STOCK,
    RESERVED,
    SOLD,
    DAMAGED,
    INSPECTION,
    RETURNED,
    SCRAPPED
}
