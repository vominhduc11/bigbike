package com.bigbike.bigbike_backend.api.admin.dto.customer;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminCustomerOrderSummaryResponse(
        int orderCount,
        BigDecimal totalSpent,
        BigDecimal avgOrderValue,
        String segment,
        Instant firstOrderAt,
        Instant lastOrderAt,
        List<LatestOrder> latestOrders
) {
    public record LatestOrder(
            UUID id,
            String orderNumber,
            String status,
            BigDecimal totalAmount,
            Instant placedAt
    ) {}
}
