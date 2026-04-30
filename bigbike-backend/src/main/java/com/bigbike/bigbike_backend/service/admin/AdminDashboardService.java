package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.dashboard.AdminDashboardSummaryResponse;
import com.bigbike.bigbike_backend.api.admin.dto.dashboard.AdminDashboardSummaryResponse.KpiResponse;
import com.bigbike.bigbike_backend.api.admin.dto.dashboard.AdminDashboardSummaryResponse.OrderStatusBreakdownItem;
import com.bigbike.bigbike_backend.api.admin.dto.dashboard.AdminDashboardSummaryResponse.RecentOrderItem;
import com.bigbike.bigbike_backend.api.admin.dto.dashboard.AdminDashboardSummaryResponse.RevenueDayResponse;
import com.bigbike.bigbike_backend.api.admin.dto.dashboard.AdminDashboardSummaryResponse.TopProductItem;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AdminDashboardService {

    // Vietnam is UTC+7 — use named zone so DST rules are respected
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    // Real OrderStatus values (mirrors OrderStatus enum)
    private static final List<String> STATUS_ORDER = List.of(
            "PENDING", "ON_HOLD", "PROCESSING", "COMPLETED", "CANCELLED", "FAILED", "REFUNDED");

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final ProductJpaRepository productRepo;

    public AdminDashboardService(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            ProductJpaRepository productRepo
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.productRepo = productRepo;
    }

    public AdminDashboardSummaryResponse getDashboardSummary(String period) {
        int days = parseDays(period);

        LocalDate todayVn = LocalDate.now(VN_ZONE);
        Instant todayStart   = todayVn.atStartOfDay(VN_ZONE).toInstant();
        Instant prevDayStart = todayVn.minusDays(1).atStartOfDay(VN_ZONE).toInstant();
        Instant periodStart  = todayVn.minusDays(days - 1L).atStartOfDay(VN_ZONE).toInstant();

        // ── KPI aggregates (no full entity load) ─────────────────────────────
        BigDecimal todayRevenue = orderRepo.sumRevenueSince(todayStart);
        BigDecimal prevRevenue  = orderRepo.sumRevenueBetween(prevDayStart, todayStart);
        long todayOrderCount = orderRepo.countOrdersSince(todayStart);
        long prevOrderCount  = orderRepo.countOrdersBetween(prevDayStart, todayStart);

        Double revenuePct = null;
        if (prevRevenue != null && prevRevenue.compareTo(BigDecimal.ZERO) > 0) {
            revenuePct = todayRevenue.subtract(prevRevenue)
                    .divide(prevRevenue, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .setScale(1, RoundingMode.HALF_UP)
                    .doubleValue();
        }

        long pendingOrders  = orderRepo.countByStatus("PENDING");
        long activeProducts = productRepo.countByPublishStatus(PublishStatus.PUBLISHED);

        KpiResponse kpi = new KpiResponse(
                todayRevenue != null ? todayRevenue : BigDecimal.ZERO,
                revenuePct,
                (int) todayOrderCount,
                (int) (todayOrderCount - prevOrderCount),
                pendingOrders,
                activeProducts
        );

        // ── Revenue series (SQL aggregate, VN timezone, no in-memory load) ───
        List<RevenueDayResponse> revenueData = buildRevenueSeries(periodStart, todayVn, days);

        // ── Order status breakdown (period-scoped) ────────────────────────────
        List<OrderStatusBreakdownItem> breakdown = buildStatusBreakdown(periodStart);

        // ── Recent orders (last 5) ────────────────────────────────────────────
        List<RecentOrderItem> recentOrders = orderRepo
                .findRecentOrders(PageRequest.of(0, 5))
                .stream()
                .map(o -> new RecentOrderItem(
                        o.getId(),
                        o.getOrderNumber(),
                        o.getCustomerEmail(),
                        o.getTotalAmount() != null ? o.getTotalAmount() : BigDecimal.ZERO,
                        o.getStatus(),
                        o.getCurrency(),
                        o.getPlacedAt()
                ))
                .collect(Collectors.toList());

        // ── Top products (by line item revenue, period-scoped) ────────────────
        List<Object[]> rawTop = lineItemRepo.topProductsByRevenueSince(
                periodStart, PageRequest.of(0, 5));
        List<TopProductItem> topProducts = rawTop.stream()
                .map(row -> new TopProductItem(
                        (UUID) row[0],
                        (String) row[1],
                        row[2] != null ? ((BigDecimal) row[2]).setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                        row[3] != null ? ((Number) row[3]).longValue() : 0L
                ))
                .collect(Collectors.toList());

        return new AdminDashboardSummaryResponse(kpi, revenueData, breakdown, recentOrders, topProducts);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static int parseDays(String period) {
        if (period == null) return 30;
        return switch (period) {
            case "7d"  -> 7;
            case "90d" -> 90;
            default    -> 30;
        };
    }

    private List<RevenueDayResponse> buildRevenueSeries(Instant periodStart, LocalDate todayVn, int days) {
        // Pre-fill all days with zeros so missing days are shown as flat
        Map<LocalDate, long[]> byDay = new LinkedHashMap<>();
        LocalDate cursor = todayVn.minusDays(days - 1L);
        while (!cursor.isAfter(todayVn)) {
            byDay.put(cursor, new long[]{0L, 0L});
            cursor = cursor.plusDays(1);
        }

        // Overlay with actual DB results (native query handles VN timezone).
        // Postgres' DATE column maps to either java.sql.Date or java.time.LocalDate
        // depending on driver/dialect — handle both shapes.
        for (Object[] row : orderRepo.revenueSeriesSince(periodStart)) {
            if (row[0] == null) continue;
            LocalDate d = (row[0] instanceof LocalDate ld)
                    ? ld
                    : ((Date) row[0]).toLocalDate();
            if (!byDay.containsKey(d)) continue;
            long rev = row[1] != null ? ((Number) row[1]).longValue() : 0L;
            long cnt = row[2] != null ? ((Number) row[2]).longValue() : 0L;
            byDay.get(d)[0] = rev;
            byDay.get(d)[1] = cnt;
        }

        List<RevenueDayResponse> result = new ArrayList<>(byDay.size());
        for (Map.Entry<LocalDate, long[]> entry : byDay.entrySet()) {
            result.add(new RevenueDayResponse(
                    entry.getKey().toString(),          // ISO yyyy-MM-dd
                    BigDecimal.valueOf(entry.getValue()[0]),
                    (int) entry.getValue()[1]
            ));
        }
        return result;
    }

    private List<OrderStatusBreakdownItem> buildStatusBreakdown(Instant from) {
        List<Object[]> rows = orderRepo.countGroupedByStatusSince(from);
        Map<String, Long> countMap = rows.stream()
                .collect(Collectors.toMap(
                        r -> (String) r[0],
                        r -> (Long) r[1]
                ));

        List<OrderStatusBreakdownItem> result = new ArrayList<>();
        for (String status : STATUS_ORDER) {
            long count = countMap.getOrDefault(status, 0L);
            if (count > 0) {
                result.add(new OrderStatusBreakdownItem(status, count));
            }
        }
        return result;
    }
}
