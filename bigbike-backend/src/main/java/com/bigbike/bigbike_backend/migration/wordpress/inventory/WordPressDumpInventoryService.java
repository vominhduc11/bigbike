package com.bigbike.bigbike_backend.migration.wordpress.inventory;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Streams a WordPress SQL dump to extract table names and detect the table prefix.
 * Never loads the full dump into memory.
 */
@Service
public class WordPressDumpInventoryService {

    private static final Pattern CREATE_TABLE_PATTERN =
            Pattern.compile("^CREATE TABLE [`'\"]?(\\w+)[`'\"]?\\s*\\(", Pattern.CASE_INSENSITIVE);

    private static final Set<String> CORE_WP_SUFFIXES = Set.of(
            "posts", "postmeta", "users", "usermeta",
            "terms", "term_taxonomy", "term_relationships", "termmeta",
            "options", "comments", "commentmeta", "links"
    );

    private static final Set<String> WOO_LEGACY_SUFFIXES = Set.of(
            "woocommerce_order_items", "woocommerce_order_itemmeta",
            "woocommerce_tax_rates", "woocommerce_shipping_zones"
    );

    private static final Set<String> WOO_HPOS_SUFFIXES = Set.of(
            "wc_orders", "wc_order_addresses", "wc_order_operational_data",
            "wc_orders_meta", "wc_order_stats"
    );

    private static final Set<String> RANKMATH_SUFFIXES = Set.of(
            "rank_math_redirections", "rank_math_redirections_cache",
            "rank_math_404_logs", "rank_math_analytics_objects"
    );

    /**
     * Detect all table names in the dump by streaming CREATE TABLE statements.
     * Safe for large files — reads line by line.
     */
    public List<String> detectTables(Path dumpPath) throws IOException {
        List<String> tables = new ArrayList<>();
        try (BufferedReader reader = Files.newBufferedReader(dumpPath, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                Matcher m = CREATE_TABLE_PATTERN.matcher(line);
                if (m.find()) {
                    tables.add(m.group(1));
                }
            }
        }
        return tables;
    }

    /**
     * Detect the table prefix from the first CREATE TABLE statement.
     * Returns "wp_" as default if detection fails.
     */
    public String detectTablePrefix(Path dumpPath) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(dumpPath, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                Matcher m = CREATE_TABLE_PATTERN.matcher(line);
                if (m.find()) {
                    String tableName = m.group(1);
                    // Strip known WP core suffix to find prefix
                    for (String suffix : CORE_WP_SUFFIXES) {
                        if (tableName.endsWith(suffix) && tableName.length() > suffix.length()) {
                            return tableName.substring(0, tableName.length() - suffix.length());
                        }
                    }
                    // Fallback: any table starting with known non-wp prefix
                    int underscoreIdx = tableName.indexOf('_');
                    if (underscoreIdx > 0) {
                        return tableName.substring(0, underscoreIdx + 1);
                    }
                }
            }
        }
        return "wp_";
    }

    /**
     * Summarize which known table groups exist in the dump.
     */
    public DumpSummary summarizeKnownTables(List<String> tables, String prefix) {
        Set<String> suffixes = new LinkedHashSet<>();
        for (String t : tables) {
            if (t.startsWith(prefix)) {
                suffixes.add(t.substring(prefix.length()));
            }
        }

        boolean hasCoreWp = CORE_WP_SUFFIXES.stream().anyMatch(suffixes::contains);
        boolean hasWooLegacy = WOO_LEGACY_SUFFIXES.stream().anyMatch(suffixes::contains);
        boolean hasWooHpos = WOO_HPOS_SUFFIXES.stream().anyMatch(suffixes::contains);
        boolean hasRankMath = RANKMATH_SUFFIXES.stream().anyMatch(suffixes::contains);
        boolean hasFgRedirect = suffixes.contains("fg_redirect");

        return new DumpSummary(
                prefix, tables.size(), tables,
                hasCoreWp, hasWooLegacy, hasWooHpos,
                hasRankMath, hasFgRedirect
        );
    }

    public record DumpSummary(
            String tablePrefix,
            int totalTables,
            List<String> allTables,
            boolean hasCoreWordPressTables,
            boolean hasWooCommerceLegacyOrderTables,
            boolean hasWooCommerceHposTables,
            boolean hasRankMathTables,
            boolean hasFgRedirectTable
    ) {}
}
