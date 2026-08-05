package com.bigbike.bigbike_backend.migration.wordpress.live;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Captures a consistent PostgreSQL target snapshot inside a read-only transaction. */
final class LiveTargetSnapshotReader {

    private static final Pattern AUDIT_PRODUCT_ID = Pattern.compile(
            "\\\"id\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"");

    Snapshot read(Connection connection) throws SQLException {
        if (!connection.isReadOnly()) {
            throw new IllegalStateException("Target JDBC connection must be read-only");
        }

        String schema = scalarString(connection, "select current_schema()", "unknown");
        boolean contentCategoriesPresent = tableExists(connection, "content_categories")
                || tableExists(connection, "article_category_map")
                || columnExists(connection, "articles", "category_id");
        boolean mediaShaPresent = columnExists(connection, "media", "content_sha256");
        boolean migrationAuditSchemaPresent = tableExists(connection, "live_migration_runs")
                && tableExists(connection, "live_migration_checkpoints");

        Map<String, List<String>> categoriesByProduct = readProductCategorySlugs(connection);
        Map<String, TargetProductAudit> productAudits = readProductAudits(connection);
        List<TargetProduct> products = readProducts(connection, categoriesByProduct, productAudits);
        List<TargetVariant> variants = readVariants(connection);
        List<TargetArticle> articles = readArticles(connection);
        Map<String, List<String>> tagsByArticle = readArticleTags(connection);
        List<TargetCategory> categories = readCategories(connection);
        List<TargetBrand> brands = readBrands(connection);
        List<TargetMedia> media = readMedia(
                connection, mediaShaPresent, readMediaAudits(connection));
        List<TargetRedirect> redirects = readRedirects(
                connection, readAdminAuditedRedirectIds(connection));

        Map<String, Long> protectedCounts = new LinkedHashMap<>();
        for (String table : List.of("customers", "orders", "admin_users")) {
            if (tableExists(connection, table)) {
                protectedCounts.put(table, scalarLong(connection, "select count(*) from " + table));
            }
        }

        long articleTagCount = tableExists(connection, "article_tags")
                ? scalarLong(connection, "select count(*) from article_tags") : 0;

        String migrationVersion = "unknown";
        if (tableExists(connection, "flyway_schema_history")) {
            migrationVersion = scalarString(connection,
                    "select coalesce(version, 'unknown') from flyway_schema_history "
                            + "where success order by installed_rank desc limit 1",
                    "unknown");
        }

        return new Snapshot(
                schema, migrationVersion, contentCategoriesPresent, mediaShaPresent,
                migrationAuditSchemaPresent,
                List.copyOf(products), List.copyOf(variants), List.copyOf(articles),
                immutableLists(tagsByArticle), List.copyOf(categories), List.copyOf(brands),
                List.copyOf(media), List.copyOf(redirects), Map.copyOf(protectedCounts),
                articleTagCount);
    }

    private List<TargetProduct> readProducts(
            Connection connection,
            Map<String, List<String>> categoriesByProduct,
            Map<String, TargetProductAudit> productAudits) throws SQLException {
        String sql = """
                select id, legacy_id, sku, slug, name, short_description, description,
                       brand_id, gender, image_id, image_url, retail_price, sale_price,
                       stock_quantity, manage_stock, backorders, weight_kg, length_cm,
                       width_cm, height_cm, seo_title, seo_description, seo_canonical_url,
                       seo_og_image_id, seo_og_image_url, publish_status,
                       gallery::text as gallery_text, videos::text as videos_text,
                       short_description_en, description_en,
                       description_blocks::text as description_blocks_text,
                       created_at, updated_at
                from products
                order by id
                """;
        List<TargetProduct> result = new ArrayList<>();
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                String id = rs.getString("id");
                TargetProductAudit audit = productAudits.getOrDefault(id, TargetProductAudit.NONE);
                result.add(new TargetProduct(
                        id, rs.getString("legacy_id"), rs.getString("sku"), rs.getString("slug"),
                        rs.getString("name"), rs.getString("short_description"),
                        rs.getString("description"), rs.getString("brand_id"),
                        rs.getString("gender"),
                        rs.getString("image_id"), rs.getString("image_url"),
                        rs.getBigDecimal("retail_price"), rs.getBigDecimal("sale_price"),
                        nullableInteger(rs, "stock_quantity"), nullableBoolean(rs, "manage_stock"),
                        rs.getString("backorders"), rs.getBigDecimal("weight_kg"),
                        rs.getBigDecimal("length_cm"), rs.getBigDecimal("width_cm"),
                        rs.getBigDecimal("height_cm"), rs.getString("seo_title"),
                        rs.getString("seo_description"), rs.getString("seo_canonical_url"),
                        rs.getString("seo_og_image_id"), rs.getString("seo_og_image_url"),
                        rs.getString("publish_status"), rs.getString("gallery_text"),
                        rs.getString("videos_text"),
                        categoriesByProduct.getOrDefault(id, List.of()),
                        instant(rs, "created_at"), instant(rs, "updated_at"),
                        audit.totalCount(), audit.adminCount(), audit.statusCount(),
                        audit.lastAuditAt(), rs.getString("short_description_en"),
                        rs.getString("description_en"),
                        rs.getString("description_blocks_text")));
            }
        }
        return result;
    }

    private Map<String, TargetProductAudit> readProductAudits(Connection connection) throws SQLException {
        if (!tableExists(connection, "audit_logs")) return Map.of();
        Map<String, MutableProductAudit> result = new HashMap<>();
        String sql = """
                select actor_type, action, before_data, after_data, created_at
                from audit_logs
                where upper(resource_type)='PRODUCT'
                order by created_at, id
                """;
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                String productId = firstAuditProductId(rs.getString("after_data"), rs.getString("before_data"));
                if (productId == null) continue;
                MutableProductAudit audit = result.computeIfAbsent(productId, ignored -> new MutableProductAudit());
                audit.totalCount++;
                if ("ADMIN".equalsIgnoreCase(rs.getString("actor_type"))) audit.adminCount++;
                if (rs.getString("action") != null
                        && rs.getString("action").toUpperCase().contains("PUBLISH_STATUS")) {
                    audit.statusCount++;
                }
                audit.lastAuditAt = instant(rs, "created_at");
            }
        }
        Map<String, TargetProductAudit> immutable = new HashMap<>();
        result.forEach((id, audit) -> immutable.put(id, new TargetProductAudit(
                audit.totalCount, audit.adminCount, audit.statusCount, audit.lastAuditAt)));
        return Map.copyOf(immutable);
    }

    private String firstAuditProductId(String... documents) {
        if (documents == null) return null;
        for (String document : documents) {
            if (document == null) continue;
            Matcher matcher = AUDIT_PRODUCT_ID.matcher(document);
            if (matcher.find() && !matcher.group(1).isBlank()) return matcher.group(1);
        }
        return null;
    }

    private Map<String, List<String>> readProductCategorySlugs(Connection connection) throws SQLException {
        Map<String, List<String>> result = new LinkedHashMap<>();
        String sql = """
                select pcm.product_id, c.slug
                from product_category_map pcm
                join categories c on c.id = pcm.category_id
                order by pcm.product_id, pcm.sort_order, c.slug
                """;
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                result.computeIfAbsent(rs.getString(1), ignored -> new ArrayList<>())
                        .add(rs.getString(2));
            }
        }
        return result;
    }

    private List<TargetVariant> readVariants(Connection connection) throws SQLException {
        String sql = """
                select v.id, v.product_id, v.sku, v.name, v.retail_price, v.sale_price,
                       v.image_id, v.image_url, v.quantity_on_hand, v.stock_state, v.is_available,
                       (select count(*) from product_variant_options pvo where pvo.variant_id=v.id) option_count,
                       (select count(*) from product_variant_gallery_images pvgi where pvgi.variant_id=v.id) gallery_count
                from product_variants v
                order by id
                """;
        List<TargetVariant> result = new ArrayList<>();
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                result.add(new TargetVariant(
                        rs.getString("id"), rs.getString("product_id"), rs.getString("sku"),
                        rs.getString("name"), rs.getBigDecimal("retail_price"),
                        rs.getBigDecimal("sale_price"), rs.getString("image_id"),
                        rs.getString("image_url"), rs.getInt("quantity_on_hand"),
                        rs.getString("stock_state"), rs.getBoolean("is_available"),
                        rs.getInt("option_count"), rs.getInt("gallery_count")));
            }
        }
        return result;
    }

    private List<TargetArticle> readArticles(Connection connection) throws SQLException {
        String sql = """
                select id, slug, title, excerpt, body, cover_image_id, cover_image_url,
                       product_image_url, publish_status, seo_title, seo_description,
                       seo_canonical_url, seo_og_image_id, seo_og_image_url, published_at,
                       excerpt_en, body_en, body_blocks::text as body_blocks_text
                from articles
                order by id
                """;
        List<TargetArticle> result = new ArrayList<>();
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                result.add(new TargetArticle(
                        rs.getString("id"), rs.getString("slug"), rs.getString("title"),
                        rs.getString("excerpt"), rs.getString("body"),
                        rs.getString("cover_image_id"), rs.getString("cover_image_url"),
                        rs.getString("product_image_url"), rs.getString("publish_status"),
                        rs.getString("seo_title"), rs.getString("seo_description"),
                        rs.getString("seo_canonical_url"), rs.getString("seo_og_image_id"),
                        rs.getString("seo_og_image_url"), rs.getObject("published_at") != null,
                        rs.getString("excerpt_en"), rs.getString("body_en"),
                        rs.getString("body_blocks_text")));
            }
        }
        return result;
    }

    private Map<String, List<String>> readArticleTags(Connection connection) throws SQLException {
        Map<String, List<String>> result = new LinkedHashMap<>();
        if (!tableExists(connection, "article_tags")) return result;
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "select article_id, tag from article_tags order by article_id, sort_order, tag")) {
            while (rs.next()) {
                result.computeIfAbsent(rs.getString(1), ignored -> new ArrayList<>())
                        .add(rs.getString(2));
            }
        }
        return result;
    }

    private List<TargetCategory> readCategories(Connection connection) throws SQLException {
        List<TargetCategory> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "select id, slug, name, is_visible, deleted from categories order by id")) {
            while (rs.next()) {
                result.add(new TargetCategory(rs.getString(1), rs.getString(2), rs.getString(3),
                        rs.getBoolean(4), rs.getBoolean(5)));
            }
        }
        return result;
    }

    private List<TargetBrand> readBrands(Connection connection) throws SQLException {
        List<TargetBrand> result = new ArrayList<>();
        try (Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery(
                     "select id, slug, name, is_visible, banner_url from brands order by id")) {
            while (rs.next()) {
                result.add(new TargetBrand(
                        rs.getString(1), rs.getString(2), rs.getString(3), rs.getBoolean(4),
                        rs.getString(5)));
            }
        }
        return result;
    }

    private List<TargetMedia> readMedia(
            Connection connection,
            boolean shaPresent,
            Map<String, TargetMediaAudit> mediaAudits) throws SQLException {
        String shaColumn = shaPresent ? "content_sha256" : "cast(null as varchar) as content_sha256";
        String sql = "select id::text, legacy_id, file_path, public_url, storage_provider, bucket, "
                + "mime_type, file_size, created_at, " + shaColumn + " from media order by id";
        List<TargetMedia> result = new ArrayList<>();
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                String id = rs.getString(1);
                TargetMediaAudit audit = mediaAudits.getOrDefault(id, TargetMediaAudit.NONE);
                result.add(new TargetMedia(
                        id, nullableLong(rs, "legacy_id"), rs.getString("file_path"),
                        rs.getString("public_url"), rs.getString("storage_provider"),
                        rs.getString("bucket"), rs.getString("mime_type"),
                        nullableLong(rs, "file_size"), rs.getString("content_sha256"),
                        instant(rs, "created_at"), audit.totalCount(), audit.adminCount()));
            }
        }
        return result;
    }

    private Map<String, TargetMediaAudit> readMediaAudits(Connection connection) throws SQLException {
        if (!tableExists(connection, "audit_logs")) return Map.of();
        Map<String, MutableMediaAudit> mutable = new HashMap<>();
        String sql = "select resource_id::text, actor_type from audit_logs "
                + "where upper(resource_type)='MEDIA' and resource_id is not null";
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                MutableMediaAudit audit = mutable.computeIfAbsent(
                        rs.getString(1), ignored -> new MutableMediaAudit());
                audit.totalCount++;
                if ("ADMIN".equalsIgnoreCase(rs.getString(2))) audit.adminCount++;
            }
        }
        Map<String, TargetMediaAudit> result = new HashMap<>();
        mutable.forEach((id, audit) -> result.put(
                id, new TargetMediaAudit(audit.totalCount, audit.adminCount)));
        return Map.copyOf(result);
    }

    private Set<String> readAdminAuditedRedirectIds(Connection connection) throws SQLException {
        if (!tableExists(connection, "audit_logs")) return Set.of();
        Set<String> result = new LinkedHashSet<>();
        String sql = "select distinct resource_id::text from audit_logs "
                + "where upper(resource_type)='REDIRECT' and upper(actor_type)='ADMIN' "
                + "and resource_id is not null";
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) result.add(rs.getString(1));
        }
        return Set.copyOf(result);
    }

    private List<TargetRedirect> readRedirects(
            Connection connection, Set<String> adminAuditedIds) throws SQLException {
        List<TargetRedirect> result = new ArrayList<>();
        String sql = "select id::text, source_pattern, target_url, redirect_type, status_code, enabled "
                + "from redirects order by id";
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                String id = rs.getString(1);
                result.add(new TargetRedirect(
                        id, rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getInt(5), rs.getBoolean(6), adminAuditedIds.contains(id)));
            }
        }
        return result;
    }

    private boolean tableExists(Connection connection, String table) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select exists(select 1 from information_schema.tables "
                        + "where table_schema=current_schema() and table_name=?)")) {
            statement.setString(1, table);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() && rs.getBoolean(1);
            }
        }
    }

    private boolean columnExists(Connection connection, String table, String column) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "select exists(select 1 from information_schema.columns "
                        + "where table_schema=current_schema() and table_name=? and column_name=?)")) {
            statement.setString(1, table);
            statement.setString(2, column);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next() && rs.getBoolean(1);
            }
        }
    }

    private long scalarLong(Connection connection, String sql) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            return rs.next() ? rs.getLong(1) : 0;
        }
    }

    private String scalarString(Connection connection, String sql, String fallback) throws SQLException {
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            return rs.next() && rs.getString(1) != null ? rs.getString(1) : fallback;
        }
    }

    private Integer nullableInteger(ResultSet rs, String column) throws SQLException {
        int value = rs.getInt(column);
        return rs.wasNull() ? null : value;
    }

    private Boolean nullableBoolean(ResultSet rs, String column) throws SQLException {
        boolean value = rs.getBoolean(column);
        return rs.wasNull() ? null : value;
    }

    private Long nullableLong(ResultSet rs, String column) throws SQLException {
        long value = rs.getLong(column);
        return rs.wasNull() ? null : value;
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static <K, V> Map<K, List<V>> immutableLists(Map<K, List<V>> input) {
        Map<K, List<V>> result = new HashMap<>();
        input.forEach((key, value) -> result.put(key, List.copyOf(value)));
        return Map.copyOf(result);
    }

    record Snapshot(
            String schema,
            String migrationVersion,
            boolean contentCategoriesPresent,
            boolean mediaShaPresent,
            boolean migrationAuditSchemaPresent,
            List<TargetProduct> products,
            List<TargetVariant> variants,
            List<TargetArticle> articles,
            Map<String, List<String>> tagsByArticle,
            List<TargetCategory> categories,
            List<TargetBrand> brands,
            List<TargetMedia> media,
            List<TargetRedirect> redirects,
            Map<String, Long> protectedCounts,
            long articleTagCount) {}

    record TargetProduct(
            String id, String legacyId, String sku, String slug, String name,
            String shortDescription, String description, String brandId, String gender,
            String imageId, String imageUrl, BigDecimal retailPrice, BigDecimal salePrice,
            Integer stockQuantity, Boolean manageStock, String backorders,
            BigDecimal weightKg, BigDecimal lengthCm, BigDecimal widthCm, BigDecimal heightCm,
            String seoTitle, String seoDescription, String seoCanonicalUrl,
            String seoOgImageId, String seoOgImageUrl, String publishStatus,
            String galleryText, String videosText,
            List<String> categorySlugs,
            Instant createdAt, Instant updatedAt,
            int auditCount, int adminAuditCount, int statusAuditCount,
            Instant lastAuditAt,
            String shortDescriptionEn, String descriptionEn, String descriptionBlocksText) {}

    private record TargetProductAudit(
            int totalCount, int adminCount, int statusCount, Instant lastAuditAt) {
        private static final TargetProductAudit NONE = new TargetProductAudit(0, 0, 0, null);
    }

    private static final class MutableProductAudit {
        private int totalCount;
        private int adminCount;
        private int statusCount;
        private Instant lastAuditAt;
    }

    record TargetVariant(
            String id, String productId, String sku, String name,
            BigDecimal retailPrice, BigDecimal salePrice, String imageId, String imageUrl,
            int quantityOnHand, String stockState, boolean available,
            int optionCount, int galleryCount) {}

    record TargetArticle(
            String id, String slug, String title, String excerpt, String body,
            String coverImageId, String coverImageUrl, String productImageUrl,
            String publishStatus, String seoTitle, String seoDescription,
            String seoCanonicalUrl, String seoOgImageId, String seoOgImageUrl,
            boolean publishedAtPresent, String excerptEn, String bodyEn, String bodyBlocksText) {}

    record TargetCategory(String id, String slug, String name, boolean visible, boolean deleted) {}
    record TargetBrand(String id, String slug, String name, boolean visible, String bannerUrl) {}
    record TargetMedia(
            String id, Long legacyId, String filePath, String publicUrl,
            String storageProvider, String bucket, String mimeType, Long fileSize,
            String contentSha256, Instant createdAt, int auditCount, int adminAuditCount) {}

    private record TargetMediaAudit(int totalCount, int adminCount) {
        private static final TargetMediaAudit NONE = new TargetMediaAudit(0, 0);
    }

    private static final class MutableMediaAudit {
        private int totalCount;
        private int adminCount;
    }
    record TargetRedirect(
            String id,
            String sourcePath,
            String targetPath,
            String redirectType,
            int statusCode,
            boolean enabled,
            boolean adminAudited) {}
}
