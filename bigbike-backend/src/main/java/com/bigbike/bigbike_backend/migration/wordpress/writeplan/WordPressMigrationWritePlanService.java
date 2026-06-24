package com.bigbike.bigbike_backend.migration.wordpress.writeplan;

import com.bigbike.bigbike_backend.migration.wordpress.report.CatalogContentDryRunResult;
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
            MigrationDomain.ARTICLES,
            MigrationDomain.REDIRECTS,
            MigrationDomain.MENUS,
            MigrationDomain.MENU_ITEMS,
            MigrationDomain.PRODUCTS,
            MigrationDomain.PRODUCT_VARIATIONS,
            MigrationDomain.CUSTOMERS,
            MigrationDomain.CUSTOMER_ADDRESSES,
            MigrationDomain.SYNTHETIC_CUSTOMERS,
            MigrationDomain.ORDERS,
            MigrationDomain.ORDER_ADDRESSES,
            MigrationDomain.ORDER_LINE_ITEMS,
            MigrationDomain.ORDER_SHIPPING_ITEMS,
            MigrationDomain.ORDER_FEE_ITEMS,
            MigrationDomain.PAYMENTS,
            // Deferred
            MigrationDomain.PRODUCT_TAGS,
            MigrationDomain.FG_REDIRECTS
    );

    public MigrationWritePlan buildPlan(
            CatalogContentDryRunResult catalog) {

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
        // Commerce (customers/orders/payments) is handled by the real import path
        // (WordPressMigrationImportService). The standalone commerce dry-run service
        // and its result type were removed alongside the coupon feature, so the
        // write-plan now only reports the catalog/content domains.

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
