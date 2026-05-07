package com.bigbike.bigbike_backend.api.admin.dto.dashboard;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminDashboardSummaryResponse(
        KpiResponse kpi,
        List<RevenueDayResponse> revenueData,
        List<OrderStatusBreakdownItem> orderStatusBreakdown,
        List<RecentOrderItem> recentOrders,
        List<TopProductItem> topProducts
) {

    public record KpiResponse(
            BigDecimal todayRevenue,       // gross GMV: SUM(totalAmount) all orders placed today
            BigDecimal todayPaidRevenue,   // actual cash collected: SUM(paidAmount) for PAID/PARTIALLY_PAID
            Double todayRevenuePct,        // null when no prev-day data
            int todayOrders,
            int todayOrdersDelta,
            long pendingOrders,
            long activeProducts
    ) {}

    public record RevenueDayResponse(
            String date,      // ISO yyyy-MM-dd, parsed by FE
            BigDecimal revenue,
            int orders
    ) {}

    // Only status + count — label/color are UI concerns handled by FE
    public record OrderStatusBreakdownItem(
            String status,
            long count
    ) {}

    public record RecentOrderItem(
            UUID id,
            String orderNumber,
            String customerName,
            String customerEmail,
            BigDecimal total,
            String orderStatus,
            String currency,
            Instant placedAt
    ) {}

    public record TopProductItem(
            String productId,             // product_pk (varchar) — covers admin-created products
            String name,
            BigDecimal revenue,
            long units
    ) {}
}
