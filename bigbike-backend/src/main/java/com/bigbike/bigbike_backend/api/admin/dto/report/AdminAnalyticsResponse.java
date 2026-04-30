package com.bigbike.bigbike_backend.api.admin.dto.report;

import java.math.BigDecimal;
import java.util.List;

public record AdminAnalyticsResponse(
        PeriodSummary summary,
        List<DailyRevenueItem> dailyRevenue,
        List<TopProductItem> topProducts,
        List<TopCustomerItem> topCustomers
) {
    public record PeriodSummary(
            BigDecimal totalRevenue,
            int orderCount,
            BigDecimal avgOrderValue,
            BigDecimal refundAmount
    ) {}

    public record DailyRevenueItem(
            String date,
            BigDecimal revenue,
            long orders
    ) {}

    public record TopProductItem(
            String productName,
            BigDecimal revenue,
            long unitsSold
    ) {}

    public record TopCustomerItem(
            String email,
            BigDecimal totalSpent,
            long orderCount
    ) {}
}
