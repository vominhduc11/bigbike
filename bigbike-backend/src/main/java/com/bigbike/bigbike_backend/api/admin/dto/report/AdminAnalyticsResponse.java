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
            BigDecimal grossOrderValue,
            BigDecimal paidRevenue,
            BigDecimal refundAmount,
            BigDecimal netRevenue,
            int orderCount,
            BigDecimal avgOrderValue
    ) {}

    public record DailyRevenueItem(
            String date,
            BigDecimal revenue,
            long orders
    ) {}

    public record TopProductItem(
            String productKey,
            String productName,
            BigDecimal revenue,
            long unitsSold
    ) {}

    public record TopCustomerItem(
            String customerKey,
            String customerEmail,
            BigDecimal revenue,
            long orderCount
    ) {}
}
