package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.DailyRevenueItem;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.PeriodSummary;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.TopCustomerItem;
import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse.TopProductItem;
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
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
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
    private static final DateTimeFormatter DT_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneOffset.UTC);

    // Statuses that represent no revenue (cancelled/failed/refunded orders are excluded
    // from totalRevenue, orderCount, AOV, and top-product/customer rankings)
    private static final List<String> EXCLUDED_STATUSES = List.of("CANCELLED", "FAILED");

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
            fromInstant = LocalDate.now(ZoneOffset.UTC).minusDays(29)
                    .atStartOfDay(ZoneOffset.UTC).toInstant();
        }
        if (toInstant == null) {
            toInstant = LocalDate.now(ZoneOffset.UTC).plusDays(1)
                    .atStartOfDay(ZoneOffset.UTC).toInstant();
        }

        // SQL-level aggregation — no entity load for summary
        BigDecimal totalRevenue = orderRepo.sumRevenueBetweenExcluding(fromInstant, toInstant, EXCLUDED_STATUSES);
        long orderCount = orderRepo.countOrdersBetweenExcluding(fromInstant, toInstant, EXCLUDED_STATUSES);
        BigDecimal aov = orderCount > 0
                ? totalRevenue.divide(BigDecimal.valueOf(orderCount), 0, RoundingMode.HALF_UP)
                : BigDecimal.ZERO;
        BigDecimal refundAmount = orderRepo.sumRefundAmountInRange(fromInstant, toInstant);

        PeriodSummary summary = new PeriodSummary(totalRevenue, (int) orderCount, aov, refundAmount);

        // Daily revenue series (VN timezone, excludes cancelled/failed)
        List<Object[]> rawDaily = orderRepo.dailyRevenueInRange(fromInstant, toInstant, EXCLUDED_STATUSES);
        List<DailyRevenueItem> dailyRevenue = rawDaily.stream()
                .map(row -> new DailyRevenueItem(
                        row[0] != null ? row[0].toString() : "",
                        row[1] != null ? new BigDecimal(row[1].toString()).setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                        row[2] != null ? ((Number) row[2]).longValue() : 0L
                ))
                .toList();

        // Top 10 products by revenue (excludes cancelled/failed line items)
        // Query: SELECT productId[0], productName[1], SUM(lineTotal)[2], SUM(quantity)[3]
        List<Object[]> rawProducts = lineItemRepo.topProductsByRevenueInRange(
                fromInstant, toInstant, EXCLUDED_STATUSES, PageRequest.of(0, 10));
        List<TopProductItem> topProducts = rawProducts.stream()
                .map(row -> new TopProductItem(
                        (String) row[1],
                        row[2] != null ? ((BigDecimal) row[2]).setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                        row[3] != null ? ((Number) row[3]).longValue() : 0L
                ))
                .toList();

        // Top 10 customers by revenue (excludes cancelled/failed orders)
        // Query: SELECT customerEmail[0], SUM(totalAmount)[1], COUNT(o)[2]
        List<Object[]> rawCustomers = orderRepo.topCustomersByRevenueInRange(
                fromInstant, toInstant, EXCLUDED_STATUSES, PageRequest.of(0, 10));
        List<TopCustomerItem> topCustomers = rawCustomers.stream()
                .map(row -> new TopCustomerItem(
                        (String) row[0],
                        row[1] != null ? ((BigDecimal) row[1]).setScale(0, RoundingMode.HALF_UP) : BigDecimal.ZERO,
                        row[2] != null ? ((Number) row[2]).longValue() : 0L
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
        // Use Pageable to limit DB load; filter status in-stream since CustomerJpaRepository
        // doesn't expose a status-indexed query
        List<CustomerEntity> customers = customerRepo
                .findAll(PageRequest.of(0, EXPORT_MAX_ROWS, Sort.by("createdAt").descending()))
                .getContent()
                .stream()
                .filter(c -> status == null || status.isBlank() || status.equalsIgnoreCase(c.getStatus()))
                .toList();

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

    private Instant parseFromDate(String from) {
        if (from == null || from.isBlank()) return null;
        try {
            return LocalDate.parse(from).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) {
            try { return Instant.parse(from); } catch (Exception ignored) { return null; }
        }
    }

    private Instant parseToDate(String to) {
        if (to == null || to.isBlank()) return null;
        try {
            return LocalDate.parse(to).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        } catch (Exception e) {
            try { return Instant.parse(to); } catch (Exception ignored) { return null; }
        }
    }
}
