package com.bigbike.bigbike_backend.migration.wordpress.report;

import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/**
 * Immutable result from WordPressCustomerOrderCouponDryRunService.run().
 * Contains per-domain counts and grouped warnings. No DB writes are performed.
 */
public record CustomerOrderCouponDryRunResult(
        boolean dryRun,
        Instant generatedAt,
        String dumpPath,

        // WP Users
        int wpUsersSource,
        int wpUsersExcludedPrivileged,
        int wpUsersMapped,
        int wpUsersSkipped,

        // Customers & addresses
        int customersMapped,
        int customerAddressesMapped,

        // Synthetic guest customers
        int syntheticCustomersSource,
        int syntheticCustomersMapped,
        int syntheticCustomersSkipped,

        // Orders
        int ordersSource,
        int ordersMapped,
        int ordersSkipped,

        // Order line items
        int lineItemsSource,
        int lineItemsMapped,
        int lineItemsSkipped,

        // Order shipping items
        int shippingItemsSource,
        int shippingItemsMapped,
        int shippingItemsSkipped,

        // Order fee items
        int feeItemsSource,
        int feeItemsMapped,
        int feeItemsSkipped,

        // Order coupon items
        int couponItemsSource,
        int couponItemsMapped,
        int couponItemsSkipped,

        // Tax items (deferred — no target table yet)
        int taxItemsSource,
        int taxItemsDeferred,

        // Payment snapshots
        int paymentsMapped,

        // Coupons (shop_coupon posts)
        int couponsSource,
        int couponsMapped,
        int couponsSkipped,

        // Warnings grouped by domain
        List<String> customerWarnings,
        List<String> orderWarnings,
        List<String> orderItemWarnings,
        List<String> paymentWarnings,
        List<String> couponWarnings,
        List<String> streamingWarnings
) {

    public int totalWarnings() {
        return customerWarnings.size() + orderWarnings.size()
                + orderItemWarnings.size() + paymentWarnings.size()
                + couponWarnings.size() + streamingWarnings.size();
    }

    public static Builder builder(Path dumpPath) {
        return new Builder(dumpPath);
    }

    public static final class Builder {
        private final String dumpPath;
        private int wpUsersSource, wpUsersExcludedPrivileged, wpUsersMapped, wpUsersSkipped;
        private int customersMapped, customerAddressesMapped;
        private int syntheticCustomersSource, syntheticCustomersMapped, syntheticCustomersSkipped;
        private int ordersSource, ordersMapped, ordersSkipped;
        private int lineItemsSource, lineItemsMapped, lineItemsSkipped;
        private int shippingItemsSource, shippingItemsMapped, shippingItemsSkipped;
        private int feeItemsSource, feeItemsMapped, feeItemsSkipped;
        private int couponItemsSource, couponItemsMapped, couponItemsSkipped;
        private int taxItemsSource, taxItemsDeferred;
        private int paymentsMapped;
        private int couponsSource, couponsMapped, couponsSkipped;
        private List<String> customerWarnings = List.of();
        private List<String> orderWarnings = List.of();
        private List<String> orderItemWarnings = List.of();
        private List<String> paymentWarnings = List.of();
        private List<String> couponWarnings = List.of();
        private List<String> streamingWarnings = List.of();

        private Builder(Path dumpPath) {
            this.dumpPath = dumpPath != null ? dumpPath.toString() : "<none>";
        }

        public Builder wpUsers(int source, int excluded, int mapped, int skipped) {
            this.wpUsersSource = source; this.wpUsersExcludedPrivileged = excluded;
            this.wpUsersMapped = mapped; this.wpUsersSkipped = skipped;
            return this;
        }
        public Builder customers(int mapped, int addresses) {
            this.customersMapped = mapped; this.customerAddressesMapped = addresses;
            return this;
        }
        public Builder syntheticCustomers(int source, int mapped, int skipped) {
            this.syntheticCustomersSource = source; this.syntheticCustomersMapped = mapped;
            this.syntheticCustomersSkipped = skipped;
            return this;
        }
        public Builder orders(int source, int mapped, int skipped) {
            this.ordersSource = source; this.ordersMapped = mapped; this.ordersSkipped = skipped;
            return this;
        }
        public Builder lineItems(int source, int mapped, int skipped) {
            this.lineItemsSource = source; this.lineItemsMapped = mapped; this.lineItemsSkipped = skipped;
            return this;
        }
        public Builder shippingItems(int source, int mapped, int skipped) {
            this.shippingItemsSource = source; this.shippingItemsMapped = mapped; this.shippingItemsSkipped = skipped;
            return this;
        }
        public Builder feeItems(int source, int mapped, int skipped) {
            this.feeItemsSource = source; this.feeItemsMapped = mapped; this.feeItemsSkipped = skipped;
            return this;
        }
        public Builder couponItems(int source, int mapped, int skipped) {
            this.couponItemsSource = source; this.couponItemsMapped = mapped; this.couponItemsSkipped = skipped;
            return this;
        }
        public Builder taxItems(int source, int deferred) {
            this.taxItemsSource = source; this.taxItemsDeferred = deferred;
            return this;
        }
        public Builder payments(int mapped) {
            this.paymentsMapped = mapped;
            return this;
        }
        public Builder coupons(int source, int mapped, int skipped) {
            this.couponsSource = source; this.couponsMapped = mapped; this.couponsSkipped = skipped;
            return this;
        }
        public Builder customerWarnings(List<String> w) {
            this.customerWarnings = List.copyOf(w); return this;
        }
        public Builder orderWarnings(List<String> w) {
            this.orderWarnings = List.copyOf(w); return this;
        }
        public Builder orderItemWarnings(List<String> w) {
            this.orderItemWarnings = List.copyOf(w); return this;
        }
        public Builder paymentWarnings(List<String> w) {
            this.paymentWarnings = List.copyOf(w); return this;
        }
        public Builder couponWarnings(List<String> w) {
            this.couponWarnings = List.copyOf(w); return this;
        }
        public Builder streamingWarnings(List<String> w) {
            this.streamingWarnings = List.copyOf(w); return this;
        }

        public CustomerOrderCouponDryRunResult build() {
            return new CustomerOrderCouponDryRunResult(
                    true, Instant.now(), dumpPath,
                    wpUsersSource, wpUsersExcludedPrivileged, wpUsersMapped, wpUsersSkipped,
                    customersMapped, customerAddressesMapped,
                    syntheticCustomersSource, syntheticCustomersMapped, syntheticCustomersSkipped,
                    ordersSource, ordersMapped, ordersSkipped,
                    lineItemsSource, lineItemsMapped, lineItemsSkipped,
                    shippingItemsSource, shippingItemsMapped, shippingItemsSkipped,
                    feeItemsSource, feeItemsMapped, feeItemsSkipped,
                    couponItemsSource, couponItemsMapped, couponItemsSkipped,
                    taxItemsSource, taxItemsDeferred,
                    paymentsMapped,
                    couponsSource, couponsMapped, couponsSkipped,
                    customerWarnings, orderWarnings, orderItemWarnings,
                    paymentWarnings, couponWarnings, streamingWarnings
            );
        }
    }
}
