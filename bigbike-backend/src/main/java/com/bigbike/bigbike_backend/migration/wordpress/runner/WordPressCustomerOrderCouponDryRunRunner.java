package com.bigbike.bigbike_backend.migration.wordpress.runner;

import com.bigbike.bigbike_backend.migration.wordpress.config.WordPressMigrationProperties;
import com.bigbike.bigbike_backend.migration.wordpress.report.CustomerOrderCouponDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.service.WordPressCustomerOrderCouponDryRunService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Phase 2C CLI runner for customer/order/coupon dry-run.
 *
 * No-op unless ALL three conditions are true:
 *   bigbike.migration.wordpress.enabled=true
 *   bigbike.migration.wordpress.dry-run=true
 *   bigbike.migration.wordpress.mode=customer-order-coupon-dry-run
 *
 * Never writes to the application database.
 *
 * Invocation:
 *   ./mvnw spring-boot:run \
 *     -Dspring-boot.run.arguments="--bigbike.migration.wordpress.enabled=true \
 *       --bigbike.migration.wordpress.dry-run=true \
 *       --bigbike.migration.wordpress.dump-path=../bigbike_vn__2026_04_17/sqldump.sql \
 *       --bigbike.migration.wordpress.mode=customer-order-coupon-dry-run"
 */
@Component
@Slf4j
public class WordPressCustomerOrderCouponDryRunRunner implements ApplicationRunner {

    private static final String MODE = "customer-order-coupon-dry-run";

    private final WordPressMigrationProperties props;
    private final WordPressCustomerOrderCouponDryRunService service;

    public WordPressCustomerOrderCouponDryRunRunner(
            WordPressMigrationProperties props,
            WordPressCustomerOrderCouponDryRunService service) {
        this.props = props;
        this.service = service;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.isEnabled() || !props.isDryRun() || !MODE.equals(props.getMode())) {
            return; // no-op on normal startup
        }
        String dumpPathStr = props.resolvedDumpPath();
        if (dumpPathStr == null || dumpPathStr.isBlank()) {
            log.warn("[Migration] {} mode active but no dump path configured.", MODE);
            return;
        }
        Path dumpPath = Path.of(dumpPathStr);
        if (!Files.exists(dumpPath)) {
            log.warn("[Migration] Dump file not found: {}", dumpPath.toAbsolutePath());
            return;
        }
        log.info("[Migration] ╔══════════════════════════════════════════════╗");
        log.info("[Migration] ║  Phase 2C Customer/Order/Coupon Dry-Run START ║");
        log.info("[Migration] ╚══════════════════════════════════════════════╝");
        log.info("[Migration] Dump: {}", dumpPath.toAbsolutePath());
        long startMs = System.currentTimeMillis();
        try {
            CustomerOrderCouponDryRunResult result = service.run(dumpPath);
            long elapsedMs = System.currentTimeMillis() - startMs;
            logStructuredCounts(result, elapsedMs);
            writeReport(buildMarkdownReport(result, dumpPath, elapsedMs));
        } catch (IOException e) {
            log.error("[Migration] Dry-run failed: {}", e.getMessage(), e);
        }
        log.info("[Migration] ╔══════════════════════════════════════════════╗");
        log.info("[Migration] ║  Phase 2C Dry-Run END                        ║");
        log.info("[Migration] ╚══════════════════════════════════════════════╝");
    }

    private void logStructuredCounts(CustomerOrderCouponDryRunResult r, long elapsedMs) {
        log.info("=== PHASE2C_COUNTS_BEGIN ===");
        log.info("wp_users.source={}", r.wpUsersSource());
        log.info("wp_users.excluded_privileged={}", r.wpUsersExcludedPrivileged());
        log.info("wp_users.mapped={}", r.wpUsersMapped());
        log.info("customers.mapped={}", r.customersMapped());
        log.info("customer_addresses.mapped={}", r.customerAddressesMapped());
        log.info("synthetic_customers.source={}", r.syntheticCustomersSource());
        log.info("synthetic_customers.mapped={}", r.syntheticCustomersMapped());
        log.info("synthetic_customers.skipped={}", r.syntheticCustomersSkipped());
        log.info("orders.source={}", r.ordersSource());
        log.info("orders.mapped={}", r.ordersMapped());
        log.info("orders.skipped={}", r.ordersSkipped());
        log.info("line_items.source={}", r.lineItemsSource());
        log.info("line_items.mapped={}", r.lineItemsMapped());
        log.info("shipping_items.source={}", r.shippingItemsSource());
        log.info("shipping_items.mapped={}", r.shippingItemsMapped());
        log.info("fee_items.source={}", r.feeItemsSource());
        log.info("fee_items.mapped={}", r.feeItemsMapped());
        log.info("coupon_items.source={}", r.couponItemsSource());
        log.info("coupon_items.mapped={}", r.couponItemsMapped());
        log.info("tax_items.source={}", r.taxItemsSource());
        log.info("tax_items.deferred={}", r.taxItemsDeferred());
        log.info("payments.mapped={}", r.paymentsMapped());
        log.info("coupons.source={}", r.couponsSource());
        log.info("coupons.mapped={}", r.couponsMapped());
        log.info("coupons.skipped={}", r.couponsSkipped());
        log.info("total.warnings={}", r.totalWarnings());
        log.info("customer.warnings={}", r.customerWarnings().size());
        log.info("order.warnings={}", r.orderWarnings().size());
        log.info("order_item.warnings={}", r.orderItemWarnings().size());
        log.info("coupon.warnings={}", r.couponWarnings().size());
        log.info("elapsed.ms={}", elapsedMs);
        log.info("=== PHASE2C_COUNTS_END ===");
    }

    String buildMarkdownReport(CustomerOrderCouponDryRunResult r, Path dumpPath, long elapsedMs) {
        long fileSizeMb = 0;
        try { fileSizeMb = Files.size(dumpPath) / (1024 * 1024); } catch (Exception ignored) {}

        StringBuilder sb = new StringBuilder(8192);
        sb.append("# PHASE 2C — CUSTOMER / ORDER / COUPON DRY-RUN REPORT\n\n");
        sb.append("> **Generated:** ").append(Instant.now()).append("  \n");
        sb.append("> **DB writes:** None — pure dry-run  \n");
        sb.append("> **Migration enabled by default:** false  \n\n");
        sb.append("---\n\n");

        sb.append("## A. Summary\n\n");
        sb.append("| Item | Value |\n|------|-------|\n");
        sb.append("| Full dry-run executed | Yes |\n");
        sb.append("| Dump path | `").append(dumpPath.toAbsolutePath()).append("` |\n");
        sb.append("| Dump size | ~").append(fileSizeMb).append(" MB |\n");
        sb.append("| DB writes | **None** |\n");
        sb.append("| Duration | ").append(elapsedMs).append(" ms (~").append(elapsedMs / 1000).append(" s) |\n\n");

        sb.append("## B. Real Dump Counts\n\n");
        sb.append("| Domain | Source | Mapped | Skipped / Deferred |\n");
        sb.append("|--------|-------:|-------:|--------------------|\n");
        row(sb, "WP Users",                 r.wpUsersSource(),          r.wpUsersMapped(),            r.wpUsersExcludedPrivileged() + " excluded (privileged) / " + r.wpUsersSkipped() + " skipped");
        row(sb, "Customers",                r.customersMapped(),         r.customersMapped(),           "—");
        row(sb, "Customer Addresses",       r.customerAddressesMapped(), r.customerAddressesMapped(),   "—");
        row(sb, "Synthetic Guest Customers",r.syntheticCustomersSource(),r.syntheticCustomersMapped(), r.syntheticCustomersSkipped() + " skipped (no email/phone)");
        row(sb, "Orders",                   r.ordersSource(),            r.ordersMapped(),              r.ordersSkipped() + " skipped");
        row(sb, "Order Line Items",         r.lineItemsSource(),         r.lineItemsMapped(),           r.lineItemsSkipped() + " skipped");
        row(sb, "Order Shipping Items",     r.shippingItemsSource(),     r.shippingItemsMapped(),       "—");
        row(sb, "Order Fee Items",          r.feeItemsSource(),          r.feeItemsMapped(),            "—");
        row(sb, "Order Coupon Items",       r.couponItemsSource(),       r.couponItemsMapped(),         "—");
        row(sb, "Tax Items",                r.taxItemsSource(),          0,                             r.taxItemsDeferred() + " deferred (no target table)");
        row(sb, "Payments",                 r.paymentsMapped(),          r.paymentsMapped(),            "—");
        row(sb, "Coupons",                  r.couponsSource(),           r.couponsMapped(),             r.couponsSkipped() + " skipped");
        sb.append("\n");

        sb.append("**Total warnings:** ").append(r.totalWarnings()).append("  \n\n");

        sb.append("## C. Warnings / Data Quality\n\n");
        sb.append("| Domain | Warnings |\n|--------|----------|\n");
        sb.append("| Customer | ").append(r.customerWarnings().size()).append(" |\n");
        sb.append("| Order | ").append(r.orderWarnings().size()).append(" |\n");
        sb.append("| Order Item | ").append(r.orderItemWarnings().size()).append(" |\n");
        sb.append("| Payment | ").append(r.paymentWarnings().size()).append(" |\n");
        sb.append("| Coupon | ").append(r.couponWarnings().size()).append(" |\n");
        sb.append("| Streaming | ").append(r.streamingWarnings().size()).append(" |\n\n");

        appendList(sb, "Top customer warnings (first 20)", r.customerWarnings(), 20);
        appendList(sb, "Top order warnings (first 20)", r.orderWarnings(), 20);
        appendList(sb, "Top order item warnings (first 20)", r.orderItemWarnings(), 20);
        appendList(sb, "Top coupon warnings (first 20)", r.couponWarnings(), 20);

        sb.append("## D. Safety Check\n\n");
        sb.append("- [x] No DB writes\n");
        sb.append("- [x] Migration disabled by default (`enabled=false`)\n");
        sb.append("- [x] Runner is no-op in normal startup\n");
        sb.append("- [x] No frontend changes\n");
        sb.append("- [x] No phpass-to-bcrypt conversion\n");
        sb.append("- [x] No media copy\n");
        sb.append("- [x] No payment gateway implementation\n");
        sb.append("- [x] `dry-run=true` enforced (default)\n\n");

        sb.append("## E. Recommended Next Phase\n\n");
        sb.append("| Phase | Scope |\n|-------|-------|\n");
        sb.append("| **Phase 2D** | Write plan + idempotent real import command |\n");
        sb.append("| **Phase 2E** | Media copy / sync (`wp-content/uploads` → storage) |\n");
        sb.append("| **Phase 2F** | Legacy phpass verifier + password rehash-on-login |\n");
        sb.append("| **Phase 3**  | Legacy URL / SEO runtime alignment |\n");

        return sb.toString();
    }

    private void row(StringBuilder sb, String domain, int source, int mapped, String note) {
        sb.append("| ").append(domain).append(" | ").append(source)
          .append(" | ").append(mapped).append(" | ").append(note).append(" |\n");
    }

    private void appendList(StringBuilder sb, String title, List<String> items, int limit) {
        if (items.isEmpty()) return;
        sb.append("### ").append(title).append(" (").append(items.size()).append(" total)\n\n");
        int shown = Math.min(items.size(), limit);
        for (int i = 0; i < shown; i++) {
            sb.append("- ").append(safe(items.get(i))).append("\n");
        }
        if (items.size() > limit) {
            sb.append("- *(").append(items.size() - limit).append(" more)*\n");
        }
        sb.append("\n");
    }

    private String safe(String s) {
        return s == null ? "" : s.replace("|", "\\|").replace("\n", " ");
    }

    private void writeReport(String content) {
        Path reportPath = Path.of("../docs/PHASE_2C_CUSTOMER_ORDER_COUPON_DRY_RUN_REPORT.md");
        try {
            Files.createDirectories(reportPath.getParent());
            Files.writeString(reportPath, content);
            log.info("[Migration] Report written → {}", reportPath.toAbsolutePath());
        } catch (IOException e) {
            log.error("[Migration] Failed to write report: {}", e.getMessage());
        }
    }
}
