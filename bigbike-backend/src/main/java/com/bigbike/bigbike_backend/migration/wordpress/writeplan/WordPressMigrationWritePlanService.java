package com.bigbike.bigbike_backend.migration.wordpress.writeplan;

import com.bigbike.bigbike_backend.migration.wordpress.report.CatalogContentDryRunResult;
import com.bigbike.bigbike_backend.migration.wordpress.report.CustomerOrderCouponDryRunResult;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Builds a MigrationWritePlan from Phase 2B + Phase 2C dry-run results.
 * No DB writes. Safe to call repeatedly.
 */
@Service
public class WordPressMigrationWritePlanService {

    /** Dependency-ordered list of domains for import. */
    public static final List<MigrationDomain> DEPENDENCY_ORDER = List.of(
            MigrationDomain.CATEGORIES,
            MigrationDomain.BRANDS,
            MigrationDomain.MEDIA,
            MigrationDomain.PAGES,
            MigrationDomain.ARTICLES,
            MigrationDomain.REDIRECTS,
            MigrationDomain.MENUS,
            MigrationDomain.MENU_ITEMS,
            MigrationDomain.PRODUCTS,
            MigrationDomain.PRODUCT_VARIATIONS,
            MigrationDomain.CUSTOMERS,
            MigrationDomain.CUSTOMER_ADDRESSES,
            MigrationDomain.SYNTHETIC_CUSTOMERS,
            MigrationDomain.COUPONS,
            MigrationDomain.ORDERS,
            MigrationDomain.ORDER_ADDRESSES,
            MigrationDomain.ORDER_LINE_ITEMS,
            MigrationDomain.ORDER_SHIPPING_ITEMS,
            MigrationDomain.ORDER_FEE_ITEMS,
            MigrationDomain.ORDER_APPLIED_COUPONS,
            MigrationDomain.PAYMENTS,
            // Deferred
            MigrationDomain.PRODUCT_TAGS,
            MigrationDomain.FG_REDIRECTS
    );

    public MigrationWritePlan buildPlan(
            CatalogContentDryRunResult catalog,
            CustomerOrderCouponDryRunResult commerce) {

        List<MigrationWriteOperation> ops = new ArrayList<>();
        List<String> globalBlockers = new ArrayList<>();
        List<String> globalWarnings = new ArrayList<>();

        // ── Catalog / Content ──────────────────────────────────────────────────

        ops.add(op(MigrationDomain.CATEGORIES, MigrationOperationType.UPSERT,
                "categories", MigrationConflictStrategy.UPSERT_BY_SLUG,
                catalog.categoriesMapped(), List.of(), List.of(),
                "upsert by slug (no legacyId column on categories table)"));

        ops.add(op(MigrationDomain.BRANDS, MigrationOperationType.UPSERT,
                "brands", MigrationConflictStrategy.UPSERT_BY_SLUG,
                catalog.brandsMapped(), List.of(), List.of(),
                "upsert by slug (no legacyId column on brands table)"));

        ops.add(op(MigrationDomain.MEDIA, MigrationOperationType.UPSERT,
                "media", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                catalog.mediaMapped(), toList(catalog.mediaWarnings()), List.of(),
                "upsert by legacyId; metadata only — no physical file copy in Phase 2D"));

        ops.add(op(MigrationDomain.PAGES, MigrationOperationType.UPSERT,
                "pages", MigrationConflictStrategy.UPSERT_BY_SLUG,
                catalog.pagesMapped(), toList(catalog.pageWarnings()), List.of(),
                "upsert by slug"));

        ops.add(op(MigrationDomain.ARTICLES, MigrationOperationType.UPSERT,
                "articles", MigrationConflictStrategy.UPSERT_BY_SLUG,
                catalog.articlesMapped(), toList(catalog.articleWarnings()), List.of(),
                "upsert by slug"));

        ops.add(op(MigrationDomain.REDIRECTS, MigrationOperationType.UPSERT,
                "redirects", MigrationConflictStrategy.UPSERT_BY_SOURCE_PATTERN,
                catalog.rankMathRedirectsMapped(), toList(catalog.rankMathRedirectWarnings()), List.of(),
                "RankMath 40 redirects; FG redirects deferred (no new_url)"));

        ops.add(op(MigrationDomain.MENUS, MigrationOperationType.UPSERT,
                "menus", MigrationConflictStrategy.UPSERT_BY_LOCATION,
                catalog.menusMapped(), toList(catalog.menuWarnings()), List.of(),
                "upsert by location"));

        ops.add(op(MigrationDomain.MENU_ITEMS, MigrationOperationType.UPSERT,
                "menu_items", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                catalog.menuItemsMapped(), List.of(), List.of(),
                "upsert by legacyId"));

        // Products — check for duplicate SKU blocker
        List<String> productBlockers = new ArrayList<>();
        List<String> productWarnings = new ArrayList<>(toList(catalog.productWarnings()));
        long dupSkuCount = catalog.productWarnings().stream()
                .filter(w -> w.startsWith("Duplicate SKU:")).count();
        if (dupSkuCount > 0) {
            productWarnings.add("WARNING: " + dupSkuCount
                    + " duplicate SKUs detected — will append -wp-{id} suffix to avoid constraint violation");
        }

        ops.add(op(MigrationDomain.PRODUCTS, MigrationOperationType.UPSERT,
                "products", MigrationConflictStrategy.UPSERT_BY_SLUG,
                catalog.productsMapped(), productWarnings, productBlockers,
                "upsert by slug; legacyId stored as id prefix 'wp-prod-{id}'; duplicate SKUs get suffix"));

        ops.add(op(MigrationDomain.PRODUCT_VARIATIONS, MigrationOperationType.UPSERT,
                "product_variants", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                catalog.variationsMapped(), toList(catalog.variationWarnings()), List.of(),
                "upsert by legacyId"));

        // Deferred — product tags
        ops.add(op(MigrationDomain.PRODUCT_TAGS, MigrationOperationType.DEFER,
                "N/A", MigrationConflictStrategy.DEFER_UNSUPPORTED,
                catalog.tagsDeferred(), List.of(), List.of(),
                "product_tags table not in target schema; deferred to Phase 2E"));
        globalWarnings.add("DEFERRED: " + catalog.tagsDeferred()
                + " product tags — target schema not defined. Phase 2E required.");

        // Deferred — FG redirects
        ops.add(op(MigrationDomain.FG_REDIRECTS, MigrationOperationType.DEFER,
                "N/A", MigrationConflictStrategy.DEFER_UNSUPPORTED,
                catalog.fgRedirectsSkipped(), List.of(), List.of(),
                "kd_fg_redirect has old_url but no new_url — 19,516 rows cannot be imported"));
        globalWarnings.add("DEFERRED: " + catalog.fgRedirectsSkipped()
                + " FG redirects — missing new_url column in source. Investigation required.");

        // ── Commerce ───────────────────────────────────────────────────────────

        if (commerce != null) {
            ops.add(op(MigrationDomain.CUSTOMERS, MigrationOperationType.UPSERT,
                    "customers", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.customersMapped(), toList(commerce.customerWarnings()), List.of(),
                    "upsert by legacyId; phpass hash stored in metadata (not verified or converted)"));

            ops.add(op(MigrationDomain.CUSTOMER_ADDRESSES, MigrationOperationType.UPSERT,
                    "customer_addresses", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.customerAddressesMapped(), List.of(), List.of(),
                    "upsert by customerId+type; billing and shipping addresses"));

            ops.add(op(MigrationDomain.SYNTHETIC_CUSTOMERS, MigrationOperationType.UPSERT,
                    "customers", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.syntheticCustomersMapped(), toList(commerce.customerWarnings()), List.of(),
                    "synthetic guest customers; keyed by billing email+phone from order meta"));

            ops.add(op(MigrationDomain.COUPONS, MigrationOperationType.UPSERT,
                    "coupons", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.couponsMapped(), toList(commerce.couponWarnings()), List.of(),
                    "upsert by legacyId, fallback code"));

            ops.add(op(MigrationDomain.ORDERS, MigrationOperationType.UPSERT,
                    "orders", MigrationConflictStrategy.UPSERT_BY_ORDER_NUMBER,
                    commerce.ordersMapped(), toList(commerce.orderWarnings()), List.of(),
                    "upsert by legacyId, fallback orderNumber/orderKey"));

            ops.add(op(MigrationDomain.ORDER_ADDRESSES, MigrationOperationType.UPSERT,
                    "order_addresses", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.ordersMapped() * 2, List.of(), List.of(),
                    "upsert by orderId+type snapshot; billing and shipping"));

            ops.add(op(MigrationDomain.ORDER_LINE_ITEMS, MigrationOperationType.UPSERT,
                    "order_line_items", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.lineItemsMapped(), toList(commerce.orderItemWarnings()), List.of(),
                    "upsert by legacyItemId"));

            ops.add(op(MigrationDomain.ORDER_SHIPPING_ITEMS, MigrationOperationType.UPSERT,
                    "order_shipping_items", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.shippingItemsMapped(), List.of(), List.of(),
                    "upsert by legacyItemId"));

            ops.add(op(MigrationDomain.ORDER_FEE_ITEMS, MigrationOperationType.UPSERT,
                    "order_fee_items", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.feeItemsMapped(), List.of(), List.of(),
                    "upsert by legacyItemId"));

            ops.add(op(MigrationDomain.ORDER_APPLIED_COUPONS, MigrationOperationType.UPSERT,
                    "order_applied_coupons", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.couponItemsMapped(), List.of(), List.of(),
                    "upsert by legacyItemId"));

            ops.add(op(MigrationDomain.PAYMENTS, MigrationOperationType.UPSERT,
                    "payments", MigrationConflictStrategy.UPSERT_BY_LEGACY_ID,
                    commerce.paymentsMapped(), toList(commerce.paymentWarnings()), List.of(),
                    "one payment snapshot per order; upsert by orderId"));
        }

        // ── Compute totals ─────────────────────────────────────────────────────
        int totalInsert = 0, totalUpsert = 0, totalSkip = 0, totalDefer = 0;
        for (MigrationWriteOperation op : ops) {
            switch (op.operationType()) {
                case INSERT -> totalInsert += op.estimatedRows();
                case UPSERT -> totalUpsert += op.estimatedRows();
                case SKIP   -> totalSkip   += op.estimatedRows();
                case DEFER  -> totalDefer  += op.estimatedRows();
            }
        }

        return new MigrationWritePlan(ops, globalBlockers, globalWarnings,
                totalInsert, totalUpsert, totalSkip, totalDefer);
    }

    private MigrationWriteOperation op(
            MigrationDomain domain,
            MigrationOperationType opType,
            String targetTable,
            MigrationConflictStrategy strategy,
            int rows,
            List<String> warnings,
            List<String> blockers,
            String reason) {
        return new MigrationWriteOperation(domain, opType, targetTable, strategy,
                rows, warnings, blockers, reason);
    }

    @SuppressWarnings("unchecked")
    private List<String> toList(Object o) {
        if (o instanceof List<?> list) return (List<String>) list;
        return List.of();
    }
}
