package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.DailyRevenueItem;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.PeriodSummary;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.TopCustomerItem;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.TopProductItem;
import com.bigbike.bigbike_backend.domain.customer.CustomerStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import jakarta.persistence.criteria.Predicate;
import java.io.IOException;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AdminReportService {

    private static final int EXPORT_MAX_ROWS = 10_000;

    // Vietnam timezone — all date boundary parsing and CSV timestamp formatting use this zone
    // to match AdminDashboardService and the AT TIME ZONE 'Asia/Ho_Chi_Minh' used in native queries.
    private static final ZoneId VN_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter DT_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(VN_ZONE);

    // REVENUE_EXCLUDED: orders that generated no revenue and should not appear in GMV/paidRevenue/count.
    private static final List<String> REVENUE_EXCLUDED = List.of("CANCELLED", "FAILED");

    // RANKING_EXCLUDED: orders excluded from topProducts/topCustomers because refunded revenue is not retained.
    private static final List<String> RANKING_EXCLUDED = List.of("CANCELLED", "FAILED", "REFUNDED");

    private final OrderJpaRepository orderRepo;
    private final OrderLineItemJpaRepository lineItemRepo;
    private final CustomerJpaRepository customerRepo;
    private final ProductJpaRepository productRepo;

    public AdminReportService(
            OrderJpaRepository orderRepo,
            OrderLineItemJpaRepository lineItemRepo,
            CustomerJpaRepository customerRepo,
            ProductJpaRepository productRepo
    ) {
        this.orderRepo = orderRepo;
        this.lineItemRepo = lineItemRepo;
        this.customerRepo = customerRepo;
        this.productRepo = productRepo;
    }

    public AdminAnalyticsResponse getAnalytics(String from, String to) {
        Instant fromInstant = parseFromDate(from);
        Instant toInstant   = parseToDate(to);

        if (fromInstant == null) {
            fromInstant = LocalDate.now(VN_ZONE).minusDays(29)
                    .atStartOfDay(VN_ZONE).toInstant();
        }
        if (toInstant == null) {
            toInstant = LocalDate.now(VN_ZONE).plusDays(1)
                    .atStartOfDay(VN_ZONE).toInstant();
        }

        // GMV: SUM(totalAmount) excl CANCELLED/FAILED — REFUNDED stays (real demand)
        BigDecimal grossOrderValue = orderRepo.sumRevenueBetweenExcluding(fromInstant, toInstant, REVENUE_EXCLUDED);

        // Paid revenue: SUM(paidAmount) for orders where payment was collected (incl. post-refund statuses)
        // paidAmount is never modified by RefundService.applyRefund() — it is the total cash collected.
        BigDecimal paidRevenue = orderRepo.sumPaidRevenueBetweenExcluding(fromInstant, toInstant, REVENUE_EXCLUDED);

        // Refund amount: SUM(refundAmount) anchored to placedAt (not refundedAt — see REPORT_RULE_011)
        BigDecimal refundAmount = orderRepo.sumRefundAmountInRange(fromInstant, toInstant);

        // Net revenue may be negative — no clamp
        BigDecimal netRevenue = paidRevenue.subtract(refundAmount);

        long orderCount = orderRepo.countOrdersBetweenExcluding(fromInstant, toInstant, REVENUE_EXCLUDED);
        BigDecimal avgOrderValue = orderCount > 0
                ? grossOrderValue.divide(BigDecimal.valueOf(orderCount), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;

        PeriodSummary summary = new PeriodSummary(
                grossOrderValue, paidRevenue, refundAmount, netRevenue,
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

        return new AdminAnalyticsResponse(summary, dailyRevenue, topProducts, topCustomers);
    }

    public byte[] exportOrdersCsv(String status, String paymentStatus, String from, String to) {
        Instant fromInstant = parseFromDate(from);
        Instant toInstant = parseToDate(to);

        Specification<OrderEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                predicates.add(cb.equal(root.get("status"), status.toUpperCase(Locale.ROOT)));
            }
            if (paymentStatus != null && !paymentStatus.isBlank()) {
                predicates.add(cb.equal(root.get("paymentStatus"), paymentStatus.toUpperCase(Locale.ROOT)));
            }
            if (fromInstant != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("placedAt"), fromInstant));
            }
            if (toInstant != null) {
                predicates.add(cb.lessThan(root.get("placedAt"), toInstant));
            }
            query.orderBy(cb.desc(root.get("placedAt")));
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        List<OrderEntity> orders = orderRepo.findAll(
                spec, PageRequest.of(0, EXPORT_MAX_ROWS, Sort.by("placedAt").descending())
        ).getContent();

        StringWriter sw = new StringWriter();
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader("order_number", "status", "payment_status", "customer_email",
                        "customer_phone", "currency", "subtotal", "discount", "shipping",
                        "total", "paid_amount", "refund_amount", "placed_at", "paid_at",
                        "completed_at", "cancelled_at", "refunded_at")
                .build();

        try (CSVPrinter printer = new CSVPrinter(sw, format)) {
            for (OrderEntity o : orders) {
                printer.printRecord(
                        o.getOrderNumber(),
                        o.getStatus(),
                        o.getPaymentStatus(),
                        o.getCustomerEmail(),
                        o.getCustomerPhone(),
                        o.getCurrency(),
                        formatDecimal(o.getSubtotalAmount()),
                        formatDecimal(o.getDiscountAmount()),
                        formatDecimal(o.getShippingAmount()),
                        formatDecimal(o.getTotalAmount()),
                        formatDecimal(o.getPaidAmount()),
                        formatDecimal(o.getRefundAmount()),
                        formatInstant(o.getPlacedAt()),
                        formatInstant(o.getPaidAt()),
                        formatInstant(o.getCompletedAt()),
                        formatInstant(o.getCancelledAt()),
                        formatInstant(o.getRefundedAt())
                );
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate CSV export.", e);
        }

        return sw.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    public byte[] exportCustomersCsv(String status) {
        // Filter status at DB level via JpaSpecificationExecutor to avoid loading all customers
        // and then filtering in memory (which would silently miss customers beyond EXPORT_MAX_ROWS).
        Specification<CustomerEntity> spec = (root, query, cb) -> {
            if (status == null || status.isBlank()) return cb.conjunction();
            String normalized = status.toUpperCase(Locale.ROOT);
            // Only allow valid CustomerStatus values to prevent unsolicited SQL
            boolean valid = Arrays.stream(CustomerStatus.values())
                    .anyMatch(s -> s.name().equals(normalized));
            if (!valid) return cb.disjunction(); // returns no rows for unknown status
            return cb.equal(root.get("status"), normalized);
        };

        List<CustomerEntity> customers = customerRepo.findAll(
                spec, PageRequest.of(0, EXPORT_MAX_ROWS, Sort.by("createdAt").descending())
        ).getContent();

        StringWriter sw = new StringWriter();
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader("id", "email", "phone", "display_name",
                        "first_name", "last_name", "status", "gender",
                        "email_verified_at", "last_login_at", "created_at")
                .build();

        try (CSVPrinter printer = new CSVPrinter(sw, format)) {
            for (CustomerEntity c : customers) {
                printer.printRecord(
                        c.getId(),
                        nvl(c.getEmail()),
                        nvl(c.getPhone()),
                        nvl(c.getDisplayName()),
                        nvl(c.getFirstName()),
                        nvl(c.getLastName()),
                        c.getStatus(),
                        nvl(c.getGender()),
                        formatInstant(c.getEmailVerifiedAt()),
                        formatInstant(c.getLastLoginAt()),
                        formatInstant(c.getCreatedAt())
                );
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate customer CSV export.", e);
        }

        return sw.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    public byte[] exportProductsCsv(String publishStatus) {
        Specification<ProductEntity> spec = (root, query, cb) -> {
            if (publishStatus == null || publishStatus.isBlank()) return cb.conjunction();
            return cb.equal(
                    cb.upper(root.get("publishStatus").as(String.class)),
                    publishStatus.toUpperCase(Locale.ROOT)
            );
        };

        List<ProductEntity> products = productRepo.findAll(
                spec, PageRequest.of(0, EXPORT_MAX_ROWS, Sort.by("createdAt").descending())
        ).getContent();

        StringWriter sw = new StringWriter();
        CSVFormat format = CSVFormat.DEFAULT.builder()
                .setHeader("id", "sku", "slug", "name",
                        "category", "brand",
                        "retail_price", "sale_price", "currency",
                        "stock_state", "publish_status",
                        "is_featured", "created_at")
                .build();

        try (CSVPrinter printer = new CSVPrinter(sw, format)) {
            for (ProductEntity p : products) {
                printer.printRecord(
                        p.getId(),
                        nvl(p.getSku()),
                        p.getSlug(),
                        p.getName(),
                        p.getCategory() != null ? p.getCategory().getName() : "",
                        p.getBrand() != null ? p.getBrand().getName() : "",
                        formatDecimal(p.getRetailPrice()),
                        formatDecimal(p.getSalePrice()),
                        p.getCurrency(),
                        p.getStockState() != null ? p.getStockState().name() : "",
                        p.getPublishStatus() != null ? p.getPublishStatus().name() : "",
                        p.getFeatured() != null ? p.getFeatured() : false,
                        formatInstant(p.getCreatedAt())
                );
            }
        } catch (IOException e) {
            throw new RuntimeException("Failed to generate product CSV export.", e);
        }

        return sw.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
    }

    private static String nvl(String s) { return s != null ? s : ""; }

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
