package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.report.AdminAnalyticsResponse;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderLineItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReportService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Native-SQL tests that require real PostgreSQL.
 *
 * Why not H2: the queries tested here use PostgreSQL-specific syntax:
 * - AT TIME ZONE 'Asia/Ho_Chi_Minh'  (dailyRevenueInRange)
 * - COALESCE(column::text, ...)       (topProducts, topCustomers)
 *
 * The 'tc' profile enables Flyway (disabled on H2 tests) and sets ddl-auto=none.
 * @ServiceConnection wires the container's JDBC URL into Spring's datasource auto-config.
 */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers
class AdminReportRepositoryQueryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired AdminReportService reportService;
    @Autowired OrderJpaRepository orderRepo;
    @Autowired OrderLineItemJpaRepository lineItemRepo;
    @Autowired CustomerJpaRepository customerRepo;

    @BeforeEach
    void clearOrders() {
        lineItemRepo.deleteAll();
        orderRepo.deleteAll();
        customerRepo.deleteAll();
    }

    // ── 1. dailyRevenue timezone boundary ─────────────────────────────────────
    //
    // VN midnight = 17:00 UTC (UTC+7).
    // Two orders 1 second apart across VN midnight must produce 2 distinct date buckets.
    // Without AT TIME ZONE they would collapse into the same UTC date → 1 bucket.
    //
    //   2026-01-01T16:59:59Z  =  2026-01-01T23:59:59+07  →  VN date 2026-01-01
    //   2026-01-01T17:00:00Z  =  2026-01-02T00:00:00+07  →  VN date 2026-01-02

    @Test
    void dailyRevenue_ordersEitherSideOfVietnamMidnight_produceTwoDistinctDateBuckets() {
        Instant lastSecondOfVnDay1   = Instant.parse("2026-01-01T16:59:59Z");
        Instant firstSecondOfVnDay2  = Instant.parse("2026-01-01T17:00:00Z");

        orderRepo.save(order("COMPLETED", "PAID", "500000", lastSecondOfVnDay1));
        orderRepo.save(order("COMPLETED", "PAID", "300000", firstSecondOfVnDay2));

        // from="2026-01-01" → VN start-of-day = 2025-12-31T17:00Z  (before both orders)
        // to="2026-01-02"   → VN start-of-day+1 = 2026-01-02T17:00Z (after both orders)
        AdminAnalyticsResponse result = reportService.getAnalytics("2026-01-01", "2026-01-02");

        List<AdminAnalyticsResponse.DailyRevenueItem> daily = result.dailyRevenue();
        assertThat(daily).hasSize(2);

        // First bucket: VN date 2026-01-01
        assertThat(daily.get(0).date()).isEqualTo("2026-01-01");
        assertThat(daily.get(0).revenue()).isEqualByComparingTo(new BigDecimal("500000"));

        // Second bucket: VN date 2026-01-02
        assertThat(daily.get(1).date()).isEqualTo("2026-01-02");
        assertThat(daily.get(1).revenue()).isEqualByComparingTo(new BigDecimal("300000"));
    }

    @Test
    void dailyRevenue_sameUTCDateAcrossVietnamMidnight_doNotCollapse() {
        // Both timestamps share the same UTC date (2026-06-14) but different VN dates.
        //   2026-06-14T16:59:00Z  =  2026-06-14T23:59+07  →  VN 2026-06-14
        //   2026-06-14T17:01:00Z  =  2026-06-15T00:01+07  →  VN 2026-06-15
        Instant vnDay14 = Instant.parse("2026-06-14T16:59:00Z");
        Instant vnDay15 = Instant.parse("2026-06-14T17:01:00Z");

        orderRepo.save(order("COMPLETED", "PAID", "1000000", vnDay14));
        orderRepo.save(order("COMPLETED", "PAID", "2000000", vnDay15));

        AdminAnalyticsResponse result = reportService.getAnalytics("2026-06-14", "2026-06-15");

        List<AdminAnalyticsResponse.DailyRevenueItem> daily = result.dailyRevenue();

        // Must be 2 distinct VN dates, not 1 UTC date
        assertThat(daily).hasSize(2);
        long distinctDates = daily.stream().map(AdminAnalyticsResponse.DailyRevenueItem::date).distinct().count();
        assertThat(distinctDates).isEqualTo(2);
    }

    // ── 2. topProducts — admin-created products (productId = null, productPk set) ──
    //
    // The JPQL query filtered `productId IS NOT NULL`, silently dropping admin products.
    // The native COALESCE query uses COALESCE(product_pk, product_id::text) as key.

    @Test
    void topProducts_adminCreatedProduct_noProductId_appearsInRanking() {
        Instant now = Instant.now();
        OrderEntity o = order("COMPLETED", "PAID", "999000", now);
        orderRepo.save(o);

        // Admin-created product: productId = null, productPk = "admin-prod-xyz"
        OrderLineItemEntity li = lineItem(o, null, "admin-prod-xyz", "BigBike Admin Product", 999_000, now);
        lineItemRepo.save(li);

        AdminAnalyticsResponse result = reportService.getAnalytics(today(), tomorrow());

        List<AdminAnalyticsResponse.TopProductItem> products = result.topProducts();
        assertThat(products).isNotEmpty();

        boolean found = products.stream()
                .anyMatch(p -> "admin-prod-xyz".equals(p.productKey()));
        assertThat(found)
                .as("admin-created product (productPk=admin-prod-xyz, productId=null) must appear in topProducts")
                .isTrue();
    }

    @Test
    void topProducts_regularProduct_uuid_appearsInRanking() {
        Instant now = Instant.now();
        OrderEntity o = order("COMPLETED", "PAID", "500000", now);
        orderRepo.save(o);

        UUID productId = UUID.randomUUID();
        OrderLineItemEntity li = lineItem(o, productId, null, "Regular Product", 500_000, now);
        lineItemRepo.save(li);

        AdminAnalyticsResponse result = reportService.getAnalytics(today(), tomorrow());

        List<AdminAnalyticsResponse.TopProductItem> products = result.topProducts();
        boolean found = products.stream()
                .anyMatch(p -> productId.toString().equals(p.productKey()));
        assertThat(found)
                .as("regular product (productId UUID, productPk=null) must appear in topProducts via COALESCE fallback")
                .isTrue();
    }

    @Test
    void topProducts_refundedOrdersExcluded_fromRanking() {
        Instant now = Instant.now();

        // COMPLETED order: should appear in ranking
        OrderEntity completed = order("COMPLETED", "PAID", "800000", now);
        orderRepo.save(completed);
        lineItemRepo.save(lineItem(completed, null, "keep-prod", "Keep Product", 800_000, now));

        // REFUNDED order: must NOT appear in topProducts (RANKING_EXCLUDED)
        OrderEntity refunded = order("REFUNDED", "REFUNDED", "1200000", now);
        orderRepo.save(refunded);
        lineItemRepo.save(lineItem(refunded, null, "refund-prod", "Refunded Product", 1_200_000, now));

        AdminAnalyticsResponse result = reportService.getAnalytics(today(), tomorrow());

        List<AdminAnalyticsResponse.TopProductItem> products = result.topProducts();

        assertThat(products.stream().anyMatch(p -> "refund-prod".equals(p.productKey())))
                .as("REFUNDED order's product must not appear in topProducts ranking")
                .isFalse();
        assertThat(products.stream().anyMatch(p -> "keep-prod".equals(p.productKey())))
                .as("COMPLETED order's product must appear in topProducts ranking")
                .isTrue();
    }

    // ── 3. topCustomers — COALESCE(customer_id::text, customer_email) group key ──
    //
    // Same customerId with different emails across orders must collapse into a SINGLE row.
    // Without COALESCE(customer_id, email) as key, each distinct email would be a separate row.

    @Test
    void topCustomers_sameCustomerId_differentEmails_collapseIntoOneRow() {
        Instant now = Instant.now();
        UUID customerId = customerRepo.save(customer()).getId();

        // Order 1: customer with email A
        OrderEntity o1 = order("COMPLETED", "PAID", "600000", now);
        o1.setCustomerId(customerId);
        o1.setCustomerEmail("old-email@example.com");
        orderRepo.save(o1);

        // Order 2: same customer, email changed to B
        OrderEntity o2 = order("COMPLETED", "PAID", "400000", now);
        o2.setCustomerId(customerId);
        o2.setCustomerEmail("new-email@example.com");
        orderRepo.save(o2);

        AdminAnalyticsResponse result = reportService.getAnalytics(today(), tomorrow());

        List<AdminAnalyticsResponse.TopCustomerItem> customers = result.topCustomers();

        // Both orders share the same customerId → must be 1 row, not 2
        long rowsForThisCustomer = customers.stream()
                .filter(c -> customerId.toString().equals(c.customerKey()))
                .count();
        assertThat(rowsForThisCustomer)
                .as("Same customerId with two different emails must produce exactly 1 topCustomers row")
                .isEqualTo(1);

        // The combined revenue must be 1,000,000 (600k + 400k)
        AdminAnalyticsResponse.TopCustomerItem row = customers.stream()
                .filter(c -> customerId.toString().equals(c.customerKey()))
                .findFirst().orElseThrow();
        assertThat(row.revenue()).isEqualByComparingTo(new BigDecimal("1000000"));
    }

    @Test
    void topCustomers_noCustomerId_groupsByEmail() {
        Instant now = Instant.now();
        String guestEmail = "guest-" + UUID.randomUUID() + "@example.com";

        // Two orders with no customerId, same email → should group as one row
        OrderEntity o1 = order("COMPLETED", "PAID", "350000", now);
        o1.setCustomerEmail(guestEmail);
        orderRepo.save(o1);

        OrderEntity o2 = order("COMPLETED", "PAID", "150000", now);
        o2.setCustomerEmail(guestEmail);
        orderRepo.save(o2);

        AdminAnalyticsResponse result = reportService.getAnalytics(today(), tomorrow());

        List<AdminAnalyticsResponse.TopCustomerItem> customers = result.topCustomers();

        // Group key = COALESCE(null::text, guestEmail) = guestEmail
        long rowsForGuest = customers.stream()
                .filter(c -> guestEmail.equals(c.customerKey()))
                .count();
        assertThat(rowsForGuest)
                .as("Guest (no customerId) with same email across 2 orders must produce exactly 1 row")
                .isEqualTo(1);

        AdminAnalyticsResponse.TopCustomerItem row = customers.stream()
                .filter(c -> guestEmail.equals(c.customerKey()))
                .findFirst().orElseThrow();
        assertThat(row.revenue()).isEqualByComparingTo(new BigDecimal("500000"));
        assertThat(row.customerEmail()).isEqualTo(guestEmail);
    }

    @Test
    void topCustomers_refundedOrdersExcluded_fromRanking() {
        Instant now = Instant.now();
        UUID custA = customerRepo.save(customer()).getId();
        UUID custB = customerRepo.save(customer()).getId();

        // custA: COMPLETED — should appear
        OrderEntity a = order("COMPLETED", "PAID", "700000", now);
        a.setCustomerId(custA);
        orderRepo.save(a);

        // custB: REFUNDED — must not appear in ranking (RANKING_EXCLUDED)
        OrderEntity b = order("REFUNDED", "REFUNDED", "1500000", now);
        b.setCustomerId(custB);
        orderRepo.save(b);

        AdminAnalyticsResponse result = reportService.getAnalytics(today(), tomorrow());

        List<AdminAnalyticsResponse.TopCustomerItem> customers = result.topCustomers();
        assertThat(customers.stream().anyMatch(c -> custB.toString().equals(c.customerKey())))
                .as("REFUNDED order customer must not appear in topCustomers ranking")
                .isFalse();
        assertThat(customers.stream().anyMatch(c -> custA.toString().equals(c.customerKey())))
                .as("COMPLETED order customer must appear in topCustomers ranking")
                .isTrue();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private CustomerEntity customer() {
        CustomerEntity c = new CustomerEntity();
        c.setStatus("ACTIVE");
        Instant now = Instant.now();
        c.setCreatedAt(now);
        c.setUpdatedAt(now);
        return c;
    }

    private OrderEntity order(String status, String paymentStatus, String totalAmount, Instant placedAt) {
        OrderEntity o = new OrderEntity();
        o.setOrderNumber("TC-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        o.setStatus(status);
        o.setPaymentStatus(paymentStatus);
        o.setTotalAmount(new BigDecimal(totalAmount));
        o.setPaidAmount(new BigDecimal(totalAmount));
        o.setPlacedAt(placedAt);
        o.setCreatedAt(placedAt);
        o.setUpdatedAt(placedAt);
        return o;
    }

    private OrderLineItemEntity lineItem(OrderEntity order, UUID productId, String productPk,
                                         String productName, long lineTotal, Instant now) {
        OrderLineItemEntity li = new OrderLineItemEntity();
        li.setOrder(order);
        li.setProductId(productId);
        li.setProductPk(productPk);
        li.setProductName(productName);
        li.setQuantity(1);
        li.setUnitPrice(new BigDecimal(lineTotal));
        li.setLineSubtotal(new BigDecimal(lineTotal));
        li.setLineDiscount(BigDecimal.ZERO);
        li.setLineTax(BigDecimal.ZERO);
        li.setLineTotal(new BigDecimal(lineTotal));
        li.setCreatedAt(now);
        li.setUpdatedAt(now);
        return li;
    }

    private static String today() {
        return java.time.LocalDate.now().toString();
    }

    private static String tomorrow() {
        return java.time.LocalDate.now().plusDays(1).toString();
    }
}
