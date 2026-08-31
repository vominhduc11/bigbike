package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.DailyRevenueItem;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.PeriodSummary;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.TopCustomerItem;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.TopProductItem;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import java.io.IOException;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class AdminReportService {

    /** Maximum rows returned per CSV export. Exposed so controller can set X-Export-Truncated header. */
    public static final int EXPORT_MAX_ROWS = 10_000;
    private static final ObjectMapper AUDIT_JSON = JsonMapper.builder().findAndAddModules().build();

    /** Wraps a CSV byte array with a flag indicating whether the result was truncated at EXPORT_MAX_ROWS. */
    public record ExportResult(byte[] csv, boolean truncated) {}

    // Vietnam timezone — all date boundary parsing and CSV timestamp formatting use this zone
    // to match AdminDashboardService and the AT TIME ZONE 'Asia/Ho_Chi_Minh' used in native queries.
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DT_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN_ZONE);

    // REVENUE_EXCLUDED: orders that generated no revenue and should not appear in GMV/paidRevenue/count.
    private static final List<String> REVENUE_EXCLUDED = List.of("CANCELLED");

    // RANKING_EXCLUDED: orders excluded from topProducts/topCustomers (no revenue generated).
    private static final List<String> RANKING_EXCLUDED = List.of("CANCELLED");

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;

    public AdminAnalyticsResponse getAnalytics(String from, String to) {
        Instant fromInstant = parseFromDate(from);
        Instant toInstant   = parseToDate(to);

        if (toInstant == null) {
            toInstant = LocalDate.now(VN_ZONE).plusDays(1)
                    .atStartOfDay(VN_ZONE).toInstant();
        }

        if (fromInstant == null) {
            if (to != null && !to.isBlank()) {
                try {
                    fromInstant = LocalDate.parse(to).minusDays(29).atStartOfDay(VN_ZONE).toInstant();
                } catch (Exception e) {
                    fromInstant = LocalDate.now(VN_ZONE).minusDays(29).atStartOfDay(VN_ZONE).toInstant();
                }
            } else {
                fromInstant = LocalDate.now(VN_ZONE).minusDays(29)
                        .atStartOfDay(VN_ZONE).toInstant();
            }
        }

        if (fromInstant.isAfter(toInstant)) {
            throw com.bigbike.bigbike_backend.api.error.ValidationException.fromField("from", "DATE_RANGE_INVALID",
                    "'from' must not be after 'to'.");
        }

        // GMV: SUM(totalAmount) excl CANCELLED
        BigDecimal grossOrderValue = orderRepo.sumRevenueBetweenExcluding(fromInstant, toInstant, REVENUE_EXCLUDED);

        // paidRevenue keeps the existing response name and uses COMPLETED order totals.
        BigDecimal paidRevenue = orderRepo.sumPaidRevenueBetween(fromInstant, toInstant);

        long orderCount = orderRepo.countOrdersBetweenExcluding(fromInstant, toInstant, REVENUE_EXCLUDED);
        BigDecimal avgOrderValue = orderCount > 0
                ? grossOrderValue.divide(BigDecimal.valueOf(orderCount), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        PeriodSummary summary = new PeriodSummary(
                grossOrderValue, paidRevenue,
                (int) orderCount, avgOrderValue);

        // Daily revenue (VN timezone grouping, REVENUE_EXCLUDED)
        List<Object[]> rawDaily = orderRepo.dailyRevenueInRange(fromInstant, toInstant, REVENUE_EXCLUDED);
        List<DailyRevenueItem> dailyRevenue = rawDaily.stream()
                .map(row -> new DailyRevenueItem(
                        row[0] != null ? row[0].toString() : "",
                        row[1] != null ? new BigDecimal(row[1].toString()).setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                        row[2] != null ? ((Number) row[2]).longValue() : 0L
                ))
                .toList();

        // Top 10 products — native COALESCE query, RANKING_EXCLUDED
        // row: [0]=productKey, [1]=productName, [2]=revenue, [3]=unitsSold
        List<Object[]> rawProducts = lineItemRepo.topProductsByRevenueInRangeNative(
                fromInstant, toInstant, RANKING_EXCLUDED, PageRequest.of(0, 10));
        List<TopProductItem> topProducts = rawProducts.stream()
                .map(row -> new TopProductItem(
                        row[0] != null ? row[0].toString() : "",
                        row[1] != null ? row[1].toString() : "",
                        row[2] != null ? new BigDecimal(row[2].toString()).setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                        row[3] != null ? ((Number) row[3]).longValue() : 0L
                ))
                .toList();

        // Top 10 customers — native COALESCE(customer_id::text, customer_email) group key, RANKING_EXCLUDED
        // row: [0]=customerKey, [1]=displayEmail, [2]=totalRevenue, [3]=orderCount
        List<Object[]> rawCustomers = orderRepo.topCustomersByRevenueInRangeCoalesce(
                fromInstant, toInstant, RANKING_EXCLUDED, PageRequest.of(0, 10));
        List<TopCustomerItem> topCustomers = rawCustomers.stream()
                .map(row -> new TopCustomerItem(
                        row[0] != null ? row[0].toString() : "",
                        row[1] != null ? row[1].toString() : "",
                        row[2] != null ? new BigDecimal(row[2].toString()).setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                        row[3] != null ? ((Number) row[3]).longValue() : 0L
                ))
                .toList();

        return new AdminAnalyticsResponse(
                summary,
                dailyRevenue,
                topProducts,
                topCustomers,
                new AdminAnalyticsResponse.Scope("ALL", true)
        );
    }

    public void recordExportAudit(
            String actorId,
            String exportType,
            Map<String, Object> filters,
            String ipAddress,
            String userAgent
    ) {
        recordExportAudit(
                actorId,
                exportType,
                filters,
                EXPORT_MAX_ROWS,
                false,
                ipAddress,
                userAgent
        );
    }

    public void recordExportAudit(
            String actorId,
            String exportType,
            Map<String, Object> filters,
            Integer rowLimit,
            boolean uncapped,
            String ipAddress,
            String userAgent
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("exportType", exportType);
        payload.put("filters", filters != null ? filters : Map.of());
        payload.put("rowLimit", rowLimit);
        payload.put("uncapped", uncapped);

        auditLogWriter.save(auditLogFactory.build(
                "ADMIN",
                parseActorId(actorId),
                "REPORT_EXPORT_CREATED",
                "REPORT",
                null,
                null,
                writeAuditJson(payload),
                ipAddress,
                userAgent));
    }

    /** Audit record for every valid streamed product catalog CSV export attempt. */
    public void recordProductCatalogCsvExportAudit(
            String actorId,
            ProductCsvExportPlan plan,
            long rowCount,
            boolean completed,
            String ipAddress,
            String userAgent
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("exportType", "PRODUCT_CATALOG_CSV");
        payload.put("scope", plan.scope().name());
        payload.put("filters", plan.auditFilters());
        payload.put("includeDraft", plan.includeDraft());
        payload.put("includeTrash", plan.includeTrash());
        payload.put("preset", plan.preset().name());
        payload.put("columnGroups", plan.columnGroups());
        payload.put("columns", plan.columns());
        payload.put("rowCount", rowCount);
        payload.put("streamed", true);
        payload.put("rowLimit", null);
        payload.put("uncapped", true);
        payload.put("completed", completed);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN", parseActorId(actorId), "REPORT_EXPORT_CREATED", "PRODUCT",
                null, null, writeAuditJson(payload), ipAddress, userAgent));
    }

    private static String nvl(String s) { return s != null ? s : ""; }

    private UUID parseActorId(String id) {
        if (id == null) {
            return null;
        }
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private String writeAuditJson(Map<String, Object> payload) {
        try {
            return AUDIT_JSON.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize report export audit payload.", exception);
        }
    }

    private String formatDecimal(BigDecimal value) {
        return value != null ? value.toPlainString() : "0";
    }

    private String formatInstant(Instant instant) {
        return instant != null ? DT_FORMAT.format(instant) : "";
    }

    // Parse YYYY-MM-DD as start-of-day in Vietnam timezone.
    // Returns null for blank/unparseable input (caller applies default).
    Instant parseFromDate(String from) {
        if (from == null || from.isBlank()) return null;
        try {
            return LocalDate.parse(from).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            try { return Instant.parse(from); } catch (Exception ignored) { return null; }
        }
    }

    // Parse YYYY-MM-DD as exclusive end boundary (next day start-of-day in Vietnam timezone).
    Instant parseToDate(String to) {
        if (to == null || to.isBlank()) return null;
        try {
            return LocalDate.parse(to).plusDays(1).atStartOfDay(VN_ZONE).toInstant();
        } catch (Exception e) {
            try { return Instant.parse(to); } catch (Exception ignored) { return null; }
        }
    }
}
