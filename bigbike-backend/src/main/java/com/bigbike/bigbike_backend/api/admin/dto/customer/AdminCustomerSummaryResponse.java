package com.bigbike.bigbike_backend.api.admin.dto.customer;

/**
 * KPI counts for the admin Customers screen.
 *
 * <ul>
 *   <li>{@code total} — every customer row.</li>
 *   <li>{@code vip} — customers whose lifetime order total reaches the VIP
 *       threshold ({@code AdminCustomerService.VIP_MIN_SPENT}).</li>
 *   <li>{@code newLast30Days} — customers registered within the last 30 days.</li>
 *   <li>{@code active} — customers with status {@code ACTIVE}.</li>
 * </ul>
 */
public record AdminCustomerSummaryResponse(
        long total,
        long vip,
        long newLast30Days,
        long active
) {}
