package db.migration;

import com.bigbike.bigbike_backend.util.SeoTextNormalizer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Repairs the SEO data found in the 2026-08-20 BigBike audit.
 *
 * <p>This is intentionally a versioned migration rather than a live database script. It
 * normalizes existing SEO fields, backfills missing metadata from the same locale's content,
 * applies the owner-approved English copy for the 13 article placeholders, and removes only the
 * seven image URLs verified as broken. Rich content fields are not converted to plain text.
 */
public class V1041__Repair_seo_metadata_and_article_images extends BaseJavaMigration {

    private static final int SEO_DESCRIPTION_MAX = 165;
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> BROKEN_IMAGE_URLS = Set.of(
            "https://bigbike.vn/media/wysiwyg/Jackets/22554718_953697174782112_6002009237971976472_n.jpg",
            "https://bigbike.vn/media/wysiwyg/Jackets/22729143_953697218115441_5895811918445629260_n.jpg",
            "https://bigbike.vn/media/wysiwyg/Jackets/Cj_ahdCUkAEx5XJ.jpg",
            "https://bigbike.vn/media/wysiwyg/ao-bao-ho-taichi-rsjj19-red.jpg",
            "https://bigbike.vn/media/wysiwyg/ao_bao_ho_taichi_rsj710_trang.JPG",
            "https://www.motogear.my/image/cache/catalog/rs-taichi/RSJJ19/image4-700x700.jpg",
            "https://www.motoworld.com.sg/image/cache/data/other/RS%20Taichi/RSJJ19/image3-800x800-0.jpg"
    );

    private static final Map<String, String> ARTICLE_EN_TITLES = Map.ofEntries(
            Map.entry("di-phuot-la-gi", "What Is Motorcycle Touring? Benefits and Latest Riding Trends"),
            Map.entry("phuot-ha-giang", "Motorcycle Trip to Ha Giang: Best Season and Detailed Itinerary"),
            Map.entry("phuot-mien-tay", "Essential Guide for a Motorcycle Trip Through the Mekong Delta"),
            Map.entry("mu-bao-hiem-agv", "Top 3 Genuine AGV Motorcycle Helmets at BigBike"),
            Map.entry("giay-di-phuot", "9 Durable Waterproof Motorcycle Touring Shoes for Riders"),
            Map.entry("kinh-nghiem-phuot-da-nang", "Detailed Motorcycle Trip Experience in Da Nang"),
            Map.entry("ao-khoac-phuot-chong-nuoc", "How to Choose a Quality Waterproof Motorcycle Jacket"),
            Map.entry("cac-hang-mu-bao-hiem", "Best Motorcycle Helmet Brands for Touring"),
            Map.entry("mua-he-nen-di-phuot-o-dau", "Where to Go on a Motorcycle Trip in Summer"),
            Map.entry("cach-chon-trang-phuc-di-phuot-cho-nam-nu", "How to Choose Motorcycle Touring Gear for Men and Women"),
            Map.entry("kinh-nghiem-di-phuot-bang-xe-may", "5 Safe Motorcycle Touring Tips for Your Next Ride"),
            Map.entry("stt-di-phuot", "20+ Motorcycle Trip Captions for Solo, Friends and Couples"),
            Map.entry("cach-gan-camera-hanh-trinh-len-mu-bao-hiem", "3 Ways to Mount an Action Camera on a Motorcycle Helmet")
    );

    private static final Map<String, String> ARTICLE_EN_DESCRIPTIONS = Map.ofEntries(
            Map.entry("di-phuot-la-gi", "Learn what motorcycle touring means, why riders enjoy it and how the latest touring trends are taking shape."),
            Map.entry("phuot-ha-giang", "Plan a motorcycle trip to Ha Giang with a practical guide to the best season, route and itinerary."),
            Map.entry("phuot-mien-tay", "Prepare for a motorcycle trip through the Mekong Delta with useful route and travel ideas."),
            Map.entry("mu-bao-hiem-agv", "Compare three genuine AGV motorcycle helmet picks and find a suitable option for your next ride."),
            Map.entry("giay-di-phuot", "Explore durable waterproof motorcycle touring shoes designed for comfort and protection on long rides."),
            Map.entry("kinh-nghiem-phuot-da-nang", "Use this practical guide to plan a motorcycle trip to Da Nang and enjoy the route with confidence."),
            Map.entry("ao-khoac-phuot-chong-nuoc", "Learn how to choose a quality waterproof motorcycle jacket for changing touring conditions."),
            Map.entry("cac-hang-mu-bao-hiem", "Discover well-known motorcycle helmet brands and choose the right helmet for touring needs."),
            Map.entry("mua-he-nen-di-phuot-o-dau", "Find ideas for summer motorcycle trips in northern, central and southern Vietnam."),
            Map.entry("cach-chon-trang-phuc-di-phuot-cho-nam-nu", "Learn how to choose safe and practical motorcycle touring gear for men and women."),
            Map.entry("kinh-nghiem-di-phuot-bang-xe-may", "Review five practical tips for a safer and more comfortable motorcycle trip."),
            Map.entry("stt-di-phuot", "Find motorcycle trip captions for solo rides, trips with friends and memorable couple journeys."),
            Map.entry("cach-gan-camera-hanh-trinh-len-mu-bao-hiem", "Follow three ways to mount an action camera on a motorcycle helmet for your next ride.")
    );

    private static final Map<String, BrandCopy> BRAND_COPY = Map.of(
            "spyke", new BrandCopy(
                    "Khám phá sản phẩm bảo hộ mô tô Spyke tại BigBike, từ trang phục đi phượt đến phụ kiện phù hợp cho từng hành trình.",
                    "Explore Spyke motorcycle riding gear and accessories at BigBike for different touring needs."),
            "ilm", new BrandCopy(
                    "Khám phá các sản phẩm ILM tại BigBike, gồm mũ bảo hiểm, giày và phụ kiện cho người đi xe máy và đi phượt.",
                    "Explore ILM helmets, riding shoes and motorcycle accessories at BigBike for everyday and touring rides."),
            "nic", new BrandCopy(
                    "Xem các sản phẩm thương hiệu NIC tại BigBike và chọn phụ kiện, đồ bảo hộ phù hợp với nhu cầu sử dụng.",
                    "Browse NIC motorcycle gear and accessories at BigBike and choose products for your riding needs."),
            "rok-straps", new BrandCopy(
                    "Khám phá dây chằng và phụ kiện ROK Straps tại BigBike cho nhu cầu cố định hành lý khi đi xe máy và đi phượt.",
                    "Explore ROK Straps tie-downs and accessories at BigBike for securing luggage on motorcycle trips.")
    );

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();

        int products = repairProducts(connection);
        int categories = repairCategories(connection);
        int brands = repairBrands(connection);
        ArticleResult articles = repairArticles(connection);

        System.out.printf(
                "[V1041] repaired SEO metadata: products=%d, categories=%d, brands=%d, articles=%d; removed broken article images=%d%n",
                products, categories, brands, articles.metadataRows(), articles.removedImages());
    }

    private int repairProducts(Connection connection) throws Exception {
        List<ProductRow> rows = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT id, name, name_en, short_description, description, short_description_en, description_en, "
                        + "seo_title, seo_description, "
                        + "seo_title_en, seo_description_en FROM products WHERE publish_status IS DISTINCT FROM 'TRASH'")) {
            try (ResultSet result = select.executeQuery()) {
                while (result.next()) {
                    rows.add(new ProductRow(
                            result.getString("id"), result.getString("name"), result.getString("name_en"),
                            result.getString("short_description"), result.getString("description"),
                            result.getString("short_description_en"), result.getString("description_en"),
                            result.getString("seo_title"), result.getString("seo_description"),
                            result.getString("seo_title_en"), result.getString("seo_description_en")));
                }
            }
        }

        int changed = 0;
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE products SET seo_title = ?, seo_description = ?, seo_title_en = ?, "
                        + "seo_description_en = ?, updated_at = NOW() WHERE id = ?")) {
            for (ProductRow row : rows) {
                String viTitle = repairTitle(row.seoTitle(), row.name(), false);
                String viDescription = repairDescription(row.seoDescription(), firstNonBlank(
                        row.shortDescription(), row.description()));
                String enTitle = repairEnglishTitle(row.seoTitleEn(), viTitle, row.nameEn());
                String enDescription = repairEnglishDescription(
                        row.seoDescriptionEn(), viDescription, firstNonBlank(row.shortDescriptionEn(), row.descriptionEn()));

                if (!same(row.seoTitle(), viTitle) || !same(row.seoDescription(), viDescription)
                        || !same(row.seoTitleEn(), enTitle) || !same(row.seoDescriptionEn(), enDescription)) {
                    setNullable(update, 1, viTitle);
                    setNullable(update, 2, viDescription);
                    setNullable(update, 3, enTitle);
                    setNullable(update, 4, enDescription);
                    update.setString(5, row.id());
                    update.addBatch();
                    changed++;
                }
            }
            update.executeBatch();
        }
        return changed;
    }

    private int repairCategories(Connection connection) throws Exception {
        List<CategoryRow> rows = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT id, name, name_en, description, description_en, intro_content, intro_content_en, "
                        + "seo_title, seo_description, seo_title_en, seo_description_en FROM categories "
                        + "WHERE deleted IS DISTINCT FROM TRUE")) {
            try (ResultSet result = select.executeQuery()) {
                while (result.next()) {
                    rows.add(new CategoryRow(
                            result.getString("id"), result.getString("name"), result.getString("name_en"),
                            result.getString("description"), result.getString("description_en"),
                            result.getString("intro_content"), result.getString("intro_content_en"),
                            result.getString("seo_title"), result.getString("seo_description"),
                            result.getString("seo_title_en"), result.getString("seo_description_en")));
                }
            }
        }

        int changed = 0;
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE categories SET seo_title = ?, seo_description = ?, seo_title_en = ?, "
                        + "seo_description_en = ?, updated_at = NOW() WHERE id = ?")) {
            for (CategoryRow row : rows) {
                String viTitle = repairTitle(row.seoTitle(), row.name(), false);
                String viDescription = repairDescription(row.seoDescription(), firstNonBlank(
                        row.description(), row.introContent()));
                String enTitle = repairEnglishTitle(row.seoTitleEn(), viTitle, row.nameEn());
                String enDescription = repairEnglishDescription(
                        row.seoDescriptionEn(), viDescription, firstNonBlank(row.descriptionEn(), row.introContentEn()));

                if (!same(row.seoTitle(), viTitle) || !same(row.seoDescription(), viDescription)
                        || !same(row.seoTitleEn(), enTitle) || !same(row.seoDescriptionEn(), enDescription)) {
                    setNullable(update, 1, viTitle);
                    setNullable(update, 2, viDescription);
                    setNullable(update, 3, enTitle);
                    setNullable(update, 4, enDescription);
                    update.setString(5, row.id());
                    update.addBatch();
                    changed++;
                }
            }
            update.executeBatch();
        }
        return changed;
    }

    private int repairBrands(Connection connection) throws Exception {
        List<BrandRow> rows = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT id, slug, name, description, description_en, seo_title, seo_description, "
                        + "seo_title_en, seo_description_en FROM brands")) {
            try (ResultSet result = select.executeQuery()) {
                while (result.next()) {
                    rows.add(new BrandRow(
                            result.getString("id"), result.getString("slug"), result.getString("name"),
                            result.getString("description"), result.getString("description_en"),
                            result.getString("seo_title"), result.getString("seo_description"),
                            result.getString("seo_title_en"), result.getString("seo_description_en")));
                }
            }
        }

        int changed = 0;
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE brands SET seo_title = ?, seo_description = ?, seo_title_en = ?, "
                        + "seo_description_en = ?, updated_at = NOW() WHERE id = ?")) {
            for (BrandRow row : rows) {
                BrandCopy copy = BRAND_COPY.get(row.slug());
                String viFallback = firstNonBlank(row.description(), copy == null ? null : copy.viDescription());
                String enFallback = firstNonBlank(row.descriptionEn(), copy == null ? null : copy.enDescription());
                String viTitle = repairTitle(row.seoTitle(), row.name(), false);
                String viDescription = repairDescription(row.seoDescription(), viFallback);
                // Brand names and slugs are shared by contract; a shared title here is intentional.
                String enTitle = repairTitle(row.seoTitleEn(), row.name(), false);
                String enDescription = repairEnglishDescription(row.seoDescriptionEn(), viDescription, enFallback);

                if (!same(row.seoTitle(), viTitle) || !same(row.seoDescription(), viDescription)
                        || !same(row.seoTitleEn(), enTitle) || !same(row.seoDescriptionEn(), enDescription)) {
                    setNullable(update, 1, viTitle);
                    setNullable(update, 2, viDescription);
                    setNullable(update, 3, enTitle);
                    setNullable(update, 4, enDescription);
                    update.setString(5, row.id());
                    update.addBatch();
                    changed++;
                }
            }
            update.executeBatch();
        }
        return changed;
    }

    private ArticleResult repairArticles(Connection connection) throws Exception {
        List<ArticleRow> rows = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(
                "SELECT id, slug, title, title_en, excerpt, excerpt_en, body, body_en, body_blocks, "
                        + "seo_title, seo_description, seo_title_en, seo_description_en FROM articles "
                        + "WHERE publish_status IS DISTINCT FROM 'TRASH'")) {
            try (ResultSet result = select.executeQuery()) {
                while (result.next()) {
                    rows.add(new ArticleRow(
                            result.getString("id"), result.getString("slug"), result.getString("title"),
                            result.getString("title_en"), result.getString("excerpt"), result.getString("excerpt_en"),
                            result.getString("body"), result.getString("body_en"), result.getString("body_blocks"),
                            result.getString("seo_title"), result.getString("seo_description"),
                            result.getString("seo_title_en"), result.getString("seo_description_en")));
                }
            }
        }

        int metadataRows = 0;
        int removedImages = 0;
        try (PreparedStatement update = connection.prepareStatement(
                "UPDATE articles SET title_en = ?, seo_title = ?, seo_description = ?, seo_title_en = ?, "
                        + "seo_description_en = ?, body = ?, body_en = ?, body_blocks = ?::jsonb, "
                        + "updated_at = NOW() WHERE id = ?")) {
            for (ArticleRow row : rows) {
                String mappedTitleEn = ARTICLE_EN_TITLES.get(row.slug());
                String titleEn = firstNonBlank(row.titleEn(), mappedTitleEn);
                String viTitle = repairTitle(row.seoTitle(), row.title(), false);
                String viDescription = repairDescription(row.seoDescription(), firstNonBlank(row.excerpt(), row.body()));
                String enTitle = repairEnglishTitle(row.seoTitleEn(), viTitle, titleEn);
                String enDescription = repairEnglishDescription(
                        row.seoDescriptionEn(), viDescription,
                        firstNonBlank(row.excerptEn(), row.bodyEn(), ARTICLE_EN_DESCRIPTIONS.get(row.slug())));

                String body = removeBrokenImagesFromHtml(row.body());
                String bodyEn = removeBrokenImagesFromHtml(row.bodyEn());
                String bodyBlocks = removeBrokenImagesFromBlocks(row.bodyBlocks());
                int rowRemovedImages = countRemovedImageReferences(row.body(), body, row.bodyBlocks(), bodyBlocks)
                        + countRemovedImageReferences(row.bodyEn(), bodyEn, null, null);

                boolean metadataChanged = !same(row.titleEn(), titleEn)
                        || !same(row.seoTitle(), viTitle) || !same(row.seoDescription(), viDescription)
                        || !same(row.seoTitleEn(), enTitle) || !same(row.seoDescriptionEn(), enDescription);
                boolean imagesChanged = !same(row.body(), body) || !same(row.bodyEn(), bodyEn)
                        || !same(row.bodyBlocks(), bodyBlocks);
                if (!metadataChanged && !imagesChanged) {
                    continue;
                }

                setNullable(update, 1, titleEn);
                setNullable(update, 2, viTitle);
                setNullable(update, 3, viDescription);
                setNullable(update, 4, enTitle);
                setNullable(update, 5, enDescription);
                setNullable(update, 6, body);
                setNullable(update, 7, bodyEn);
                setNullable(update, 8, bodyBlocks);
                update.setString(9, row.id());
                update.addBatch();
                if (metadataChanged) metadataRows++;
                removedImages += rowRemovedImages;
            }
            update.executeBatch();
        }
        return new ArticleResult(metadataRows, removedImages);
    }

    private static String removeBrokenImagesFromHtml(String html) {
        if (html == null || html.isBlank()) {
            return html;
        }
        Document document = Jsoup.parseBodyFragment(html);
        int removed = 0;
        for (Element image : new ArrayList<>(document.select("img[src]"))) {
            if (BROKEN_IMAGE_URLS.contains(image.attr("src"))) {
                image.remove();
                removed++;
            }
        }
        return removed == 0 ? html : document.body().html();
    }

    private static String removeBrokenImagesFromBlocks(String json) throws Exception {
        if (json == null || json.isBlank()) {
            return json;
        }
        JsonNode root = MAPPER.readTree(json);
        if (root == null || root.isNull()) {
            return json;
        }
        boolean changed = removeBrokenImageBlocks(root);
        String serialized = changed ? MAPPER.writeValueAsString(root) : json;
        // Also remove a verified URL if it was embedded in a legacy HTML string rather than an
        // image block. This never touches a different URL or a different article asset.
        for (String brokenUrl : BROKEN_IMAGE_URLS) {
            serialized = serialized.replace(brokenUrl, "");
        }
        return serialized;
    }

    private static boolean removeBrokenImageBlocks(JsonNode node) {
        boolean changed = false;
        if (node.isArray()) {
            ArrayNode array = (ArrayNode) node;
            for (int i = array.size() - 1; i >= 0; i--) {
                JsonNode child = array.get(i);
                if (child.isObject() && "image".equals(child.path("type").asText())
                        && BROKEN_IMAGE_URLS.contains(child.path("url").asText())) {
                    array.remove(i);
                    changed = true;
                } else if (removeBrokenImageBlocks(child)) {
                    changed = true;
                }
            }
        } else if (node.isObject()) {
            var fields = node.fields();
            while (fields.hasNext()) {
                if (removeBrokenImageBlocks(fields.next().getValue())) {
                    changed = true;
                }
            }
        }
        return changed;
    }

    private static int countRemovedImageReferences(String beforeHtml, String afterHtml,
                                                   String beforeBlocks, String afterBlocks) {
        Set<String> removed = new java.util.HashSet<>();
        for (String url : BROKEN_IMAGE_URLS) {
            boolean wasPresent = (beforeHtml != null && beforeHtml.contains(url))
                    || (beforeBlocks != null && beforeBlocks.contains(url));
            boolean remainsPresent = (afterHtml != null && afterHtml.contains(url))
                    || (afterBlocks != null && afterBlocks.contains(url));
            if (wasPresent && !remainsPresent) {
                removed.add(url);
            }
        }
        return removed.size();
    }

    private static String repairTitle(String current, String fallback, boolean placeholderAllowed) {
        String normalized = SeoTextNormalizer.toPlainText(current);
        if (!placeholderAllowed && isPlaceholder(current)) {
            normalized = null;
        }
        return normalized == null ? SeoTextNormalizer.toPlainText(fallback) : normalized;
    }

    private static String repairEnglishTitle(String current, String viTitle, String fallback) {
        String normalized = SeoTextNormalizer.toPlainText(current);
        String englishFallback = SeoTextNormalizer.toPlainText(fallback);
        if (englishFallback != null && (normalized == null || isPlaceholder(current) || same(normalized, viTitle))) {
            return englishFallback;
        }
        return normalized;
    }

    private static String repairDescription(String current, String fallback) {
        String normalized = SeoTextNormalizer.toDescription(current, SEO_DESCRIPTION_MAX);
        return normalized == null ? SeoTextNormalizer.toDescription(fallback, SEO_DESCRIPTION_MAX) : normalized;
    }

    private static String repairEnglishDescription(String current, String viDescription, String fallback) {
        String normalized = SeoTextNormalizer.toDescription(current, SEO_DESCRIPTION_MAX);
        String englishFallback = SeoTextNormalizer.toDescription(fallback, SEO_DESCRIPTION_MAX);
        if (englishFallback != null && (normalized == null || same(normalized, viDescription))) {
            return englishFallback;
        }
        return normalized;
    }

    private static boolean isPlaceholder(String value) {
        return value != null && (value.contains("%title%") || value.contains("%sitename%") || value.contains("%sep%"));
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return null;
    }

    private static boolean same(String left, String right) {
        if (left == null || left.isBlank()) return right == null || right.isBlank();
        return left.equals(right);
    }

    private static void setNullable(PreparedStatement statement, int index, String value) throws Exception {
        if (value == null) statement.setNull(index, Types.VARCHAR);
        else statement.setString(index, value);
    }

    private record ProductRow(String id, String name, String nameEn, String shortDescription,
                              String description, String shortDescriptionEn, String descriptionEn,
                              String seoTitle, String seoDescription, String seoTitleEn,
                              String seoDescriptionEn) {
    }

    private record CategoryRow(String id, String name, String nameEn, String description,
                               String descriptionEn, String introContent, String introContentEn,
                               String seoTitle, String seoDescription, String seoTitleEn,
                               String seoDescriptionEn) {
    }

    private record BrandRow(String id, String slug, String name, String description,
                            String descriptionEn, String seoTitle, String seoDescription,
                            String seoTitleEn, String seoDescriptionEn) {
    }

    private record ArticleRow(String id, String slug, String title, String titleEn, String excerpt,
                              String excerptEn, String body, String bodyEn, String bodyBlocks,
                              String seoTitle, String seoDescription, String seoTitleEn,
                              String seoDescriptionEn) {
    }

    private record BrandCopy(String viDescription, String enDescription) {
    }

    private record ArticleResult(int metadataRows, int removedImages) {
    }
}
