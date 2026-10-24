package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.MediaReferenceItem;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Checks whether a media asset is referenced by any other content tables.
 * Used to block hard-delete when references exist (P0-5) and to power the
 * "in use / unused" filter in the media library.
 *
 * <p>Reference columns store either the canonical {@code /media/...} relative URL
 * or a legacy absolute URL like {@code http://localhost:9000/bigbike-media/...}.
 * Both contain the {@code media.file_path} as a suffix, so detection is by
 * {@code <ref_column> LIKE '%' || file_path}. Slider images live inside JSON,
 * so a containment check is performed on the textified JSON blob.
 */
@Service
@RequiredArgsConstructor
public class MediaReferenceService {

    private final JdbcTemplate jdbc;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    public boolean hasReferences(MediaEntity media) {
        if (media == null) return false;
        return !getReferences(media).isEmpty();
    }

    /**
     * Returns all entities that reference the given media asset, matched by
     * {@code file_path} suffix (covers both relative and legacy absolute URLs).
     */
    public List<MediaReferenceItem> getReferences(MediaEntity media) {
        if (media == null || media.getFilePath() == null || media.getFilePath().isBlank()) {
            return List.of();
        }
        String suffix = "%" + media.getFilePath();
        String anywhere = "%" + media.getFilePath() + "%";
        String mediaId = media.getId() == null ? null : media.getId().toString();

        List<MediaReferenceItem> refs = new ArrayList<>();

        collectLike(refs, "SELECT id::text, name FROM products WHERE image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(1)));

        collectLike(refs, "SELECT id::text, name FROM products WHERE seo_og_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT_SEO_OG", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(1)));
        collectLike(refs, "SELECT id::text, name FROM products WHERE gallery::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("PRODUCT_GALLERY", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(1)));
        collectLike(refs, "SELECT id::text, name FROM products WHERE videos::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("PRODUCT_VIDEO", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(1)));
        for (String column : new String[] {
                "description", "description_en", "description_blocks", "suitability_section",
                "size_guide_section", "size_guide", "size_guide_en", "suitability_advisory",
                "suitability_advisory_en", "specifications_html", "specifications_html_en",
                "spec_stats_html", "spec_stats_html_en", "trust_badges_html", "trust_badges_html_en",
                "quick_answer_summary", "quick_answer_summary_en", "faqs", "commitments", "highlights"
        }) {
            collectLike(refs, "SELECT id::text, name FROM products WHERE " + column + "::text LIKE ?",
                    anywhere, rs -> new MediaReferenceItem("PRODUCT_CONTENT", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(1)));
        }

        collectGalleryReferences(refs, media.getFilePath());

        if (mediaId != null) {
            collectLike(refs, "SELECT id::text, name FROM products WHERE image_id = ? OR seo_og_image_id = ?",
                    mediaId, rs -> new MediaReferenceItem("PRODUCT", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(1)), mediaId);
        }

        collectLike(refs,
                "SELECT v.id::text, COALESCE(p.name,'') || ' / ' || COALESCE(v.sku, v.id::text) AS label, p.id::text " +
                "FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT_VARIANT", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(3)));

        if (mediaId != null) {
            collectLike(refs,
                    "SELECT v.id::text, COALESCE(p.name,'') || ' / ' || COALESCE(v.sku, v.id::text) AS label, p.id::text " +
                    "FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.image_id = ?",
                    mediaId, rs -> new MediaReferenceItem("PRODUCT_VARIANT", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(3)));
        }

        collectLike(refs,
                "SELECT v.id::text, COALESCE(p.name,'') || ' / ' || COALESCE(v.sku, v.id::text) AS label, p.id::text " +
                "FROM product_variant_gallery_images g JOIN product_variants v ON v.id = g.variant_id JOIN products p ON p.id = v.product_id WHERE g.image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT_VARIANT_GALLERY", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(3)));
        collectLike(refs,
                "SELECT v.id::text, COALESCE(p.name,'') || ' / ' || COALESCE(v.sku, v.id::text) AS label, p.id::text " +
                "FROM product_variant_gallery_images g JOIN product_variants v ON v.id = g.variant_id JOIN products p ON p.id = v.product_id WHERE g.video_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT_VARIANT_VIDEO", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(3)));
        if (mediaId != null) {
            collectLike(refs,
                    "SELECT g.id::text, COALESCE(p.name,'') || ' / ' || COALESCE(v.sku, v.id::text) AS label, p.id::text " +
                    "FROM product_variant_gallery_images g JOIN product_variants v ON v.id = g.variant_id JOIN products p ON p.id = v.product_id WHERE g.image_id = ?",
                    mediaId, rs -> new MediaReferenceItem("PRODUCT_VARIANT_GALLERY", rs.getString(1), rs.getString(2), "/admin/products/" + rs.getString(3)));
        }

        collectLike(refs, "SELECT id::text, name FROM categories WHERE image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CATEGORY", rs.getString(1), rs.getString(2), "/admin/categories/" + rs.getString(1)));
        for (String column : new String[] {
                "icon_url", "menu_icon_url", "banner_url", "intro_content", "intro_content_en",
                "description", "description_en", "seo_og_image_url"
        }) {
            collectLike(refs, "SELECT id::text, name FROM categories WHERE " + column + "::text LIKE ?",
                    anywhere, rs -> new MediaReferenceItem("CATEGORY", rs.getString(1), rs.getString(2), "/admin/categories/" + rs.getString(1)));
        }
        if (mediaId != null) {
            collectLike(refs, "SELECT id::text, name FROM categories WHERE image_id = ? OR icon_id = ? OR seo_og_image_id = ?",
                    mediaId, rs -> new MediaReferenceItem("CATEGORY", rs.getString(1), rs.getString(2), "/admin/categories/" + rs.getString(1)), mediaId, mediaId);
        }

        collectLike(refs, "SELECT id::text, name FROM brands WHERE logo_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("BRAND", rs.getString(1), rs.getString(2), "/admin/brands/" + rs.getString(1)));
        for (String column : new String[] {"banner_url", "description", "description_en", "seo_og_image_url"}) {
            collectLike(refs, "SELECT id::text, name FROM brands WHERE " + column + "::text LIKE ?",
                    anywhere, rs -> new MediaReferenceItem("BRAND", rs.getString(1), rs.getString(2), "/admin/brands/" + rs.getString(1)));
        }
        if (mediaId != null) {
            collectLike(refs, "SELECT id::text, name FROM brands WHERE logo_id = ? OR seo_og_image_id = ?",
                    mediaId, rs -> new MediaReferenceItem("BRAND", rs.getString(1), rs.getString(2), "/admin/brands/" + rs.getString(1)), mediaId);
        }

        collectLike(refs, "SELECT id::text, title FROM home_videos WHERE video_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("HOME_VIDEO", rs.getString(1), rs.getString(2), "/admin/home-videos"));
        collectLike(refs, "SELECT id::text, title FROM home_videos WHERE thumbnail::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("HOME_VIDEO_THUMBNAIL", rs.getString(1), rs.getString(2), "/admin/home-videos"));

        collectLike(refs, "SELECT id::text, title FROM articles WHERE cover_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CONTENT", rs.getString(1), rs.getString(2), "/admin/content/ARTICLE/" + rs.getString(1)));

        collectLike(refs, "SELECT id::text, title FROM articles WHERE seo_og_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CONTENT_SEO_OG", rs.getString(1), rs.getString(2), "/admin/content/ARTICLE/" + rs.getString(1)));
        for (String column : new String[] {"product_image_url", "body", "body_en", "body_blocks"}) {
            collectLike(refs, "SELECT id::text, title FROM articles WHERE " + column + "::text LIKE ?",
                    anywhere, rs -> new MediaReferenceItem("CONTENT", rs.getString(1), rs.getString(2), "/admin/content/ARTICLE/" + rs.getString(1)));
        }
        if (mediaId != null) {
            collectLike(refs, "SELECT id::text, title FROM articles WHERE cover_image_id = ? OR seo_og_image_id = ?",
                    mediaId, rs -> new MediaReferenceItem("CONTENT", rs.getString(1), rs.getString(2), "/admin/content/ARTICLE/" + rs.getString(1)), mediaId);
        }

        // Sliders: file_path may appear anywhere inside the JSON blob (not necessarily at the end)
        collectLike(refs, "SELECT id::text, COALESCE(location,'') FROM sliders WHERE desktop_image::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("SLIDER_DESKTOP", rs.getString(1), "Banner desktop – " + rs.getString(2), "/admin/sliders"));

        collectLike(refs, "SELECT id::text, COALESCE(location,'') FROM sliders WHERE mobile_image::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("SLIDER_MOBILE", rs.getString(1), "Banner mobile – " + rs.getString(2), "/admin/sliders"));

        collectLike(refs, "SELECT id::text, setting_key FROM site_settings WHERE setting_value::text LIKE ? OR setting_value_en::text LIKE ? OR description::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("SITE_SETTING", rs.getString(1), rs.getString(2), "/admin/settings"), anywhere, anywhere);
        collectLike(refs, "SELECT mi.id::text, COALESCE(m.name,'') || ' / ' || COALESCE(mi.label,'') FROM menu_items mi JOIN menus m ON m.id = mi.menu_id WHERE mi.url LIKE ?",
                anywhere, rs -> new MediaReferenceItem("MENU", rs.getString(1), rs.getString(2), "/admin/menus"));
        collectLike(refs, "SELECT id::text, COALESCE(author_name,'') FROM reviews WHERE photos::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("REVIEW", rs.getString(1), rs.getString(2), "/admin/reviews"));
        collectLike(refs, "SELECT id::text, COALESCE(product_name,'') FROM cart_items WHERE product_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CART", rs.getString(1), rs.getString(2), "/admin/orders"));
        if (mediaId != null) {
            collectLike(refs, "SELECT id::text, COALESCE(product_name,'') FROM cart_items WHERE product_image_id = ?",
                    mediaId, rs -> new MediaReferenceItem("CART", rs.getString(1), rs.getString(2), "/admin/orders"));
        }
        collectLike(refs, "SELECT oli.id::text, COALESCE(oli.product_name,'') FROM order_line_items oli WHERE oli.image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("ORDER_LINE", rs.getString(1), rs.getString(2), "/admin/orders"));

        return refs;
    }

    /**
     * Returns the subset of {@code candidates} (by id) that are referenced by at least
     * one other row in the database. Matches on {@code file_path} suffix to handle
     * both relative and absolute legacy URLs.
     *
     * <p>Each table and reference blob is scanned once. Matching all candidate paths
     * together avoids scanning the entire content corpus once per media item.
     */
    public Set<java.util.UUID> getUsedMediaIds(Collection<MediaEntity> candidates) {
        if (candidates == null || candidates.isEmpty()) return Set.of();

        MediaReferenceMatcher matcher = new MediaReferenceMatcher(candidates);
        if (matcher.isEmpty()) return Set.of();
        collectReferenceBlobs().forEach(matcher::accept);
        return matcher.usedIds();
    }

    /**
     * Counts matching blobs, not occurrences inside a blob. Uses the same literal paths
     * and exact media-id rules as {@link #getUsedMediaIds(Collection)}.
     */
    public java.util.Map<java.util.UUID, Integer> getUsageCounts(Collection<MediaEntity> candidates) {
        if (candidates == null || candidates.isEmpty()) return java.util.Map.of();

        MediaReferenceMatcher matcher = new MediaReferenceMatcher(candidates);
        if (matcher.isEmpty()) return java.util.Map.of();
        collectReferenceBlobs().forEach(matcher::accept);
        return matcher.usageCounts();
    }

    /**
     * Returns true when the given MinIO object key is still referenced by any row other
     * than the given article. Used by the article hard-delete cleanup so a shared object
     * (e.g. an image reused in another article's body, a product description block, a
     * review photo or a settings HTML value) is never removed from MinIO while somebody
     * else still displays it (AUD-004).
     *
     * <p>Scans the same URL columns as {@link #getUsageCounts} plus the JSON block columns
     * that the per-media reference check does not need (article bodies, product
     * description/suitability/size-guide blocks, review photos, settings values).
     */
    public boolean isObjectKeyReferencedOutsideArticle(String objectKey, String excludeArticleId) {
        if (objectKey == null || objectKey.isBlank()) return false;

        String[] blobQueries = {
                // A media-library row still owns this object: its lifecycle belongs to the
                // library (which has its own reference-checked delete) — never remove the
                // file behind an existing media entry.
                "SELECT file_path FROM media WHERE file_path IS NOT NULL AND file_path <> ''",
                "SELECT image_url FROM products WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT gallery::text FROM products WHERE gallery IS NOT NULL",
                "SELECT description_blocks::text FROM products WHERE description_blocks IS NOT NULL",
                "SELECT suitability_section::text FROM products WHERE suitability_section IS NOT NULL",
                "SELECT size_guide_section::text FROM products WHERE size_guide_section IS NOT NULL",
                "SELECT image_url FROM product_variants WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT image_url FROM product_variant_gallery_images WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT image_url FROM categories WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT logo_url FROM brands WHERE logo_url IS NOT NULL AND logo_url <> ''",
                "SELECT video_url FROM home_videos WHERE video_url IS NOT NULL AND video_url <> ''",
                "SELECT COALESCE(desktop_image::text,'') || ' ' || COALESCE(mobile_image::text,'') FROM sliders",
                "SELECT photos::text FROM reviews WHERE photos IS NOT NULL",
                "SELECT setting_value FROM site_settings WHERE setting_value IS NOT NULL AND setting_value <> ''",
        };
        for (String sql : blobQueries) {
            for (String blob : jdbc.query(sql, (rs, i) -> rs.getString(1))) {
                if (blob != null && blob.contains(objectKey)) return true;
            }
        }

        // Other articles (cover + og + body blocks) — the article being deleted is excluded.
        List<String> articleBlobs = jdbc.query(
                "SELECT COALESCE(cover_image_url,'') || ' ' || COALESCE(seo_og_image_url,'') || ' ' " +
                "|| COALESCE(body_blocks::text,'') FROM articles WHERE id <> ?",
                (rs, i) -> rs.getString(1), excludeArticleId);
        for (String blob : articleBlobs) {
            if (blob != null && blob.contains(objectKey)) return true;
        }
        return false;
    }

    @FunctionalInterface
    private interface RowMapper {
        MediaReferenceItem map(java.sql.ResultSet rs) throws java.sql.SQLException;
    }

    private void collectLike(List<MediaReferenceItem> target, String sql, String pattern, RowMapper mapper,
                             String... additionalPatterns) {
        RowCallbackHandler handler = rs -> target.add(mapper.map(rs));
        Object[] parameters = new Object[1 + additionalPatterns.length];
        parameters[0] = pattern;
        System.arraycopy(additionalPatterns, 0, parameters, 1, additionalPatterns.length);
        jdbc.query(sql, handler, parameters);
    }

    /**
     * Reads every current media-bearing field in one reusable list. The media library can be
     * referenced by a URL, an HTML/JSON fragment, a cart/order snapshot, or a stored media id;
     * hard-delete and usage counts must use the same complete inventory.
     */
    private List<String> collectReferenceBlobs() {
        // One read per table; keep each field a separate blob so usage counts stay identical.
        String[] queries = {
                """
                SELECT image_url, seo_og_image_url, description,
                       description_en, gallery::text, videos::text,
                       description_blocks::text, suitability_section::text, size_guide_section::text,
                       size_guide, size_guide_en, suitability_advisory,
                       suitability_advisory_en, specifications_html, specifications_html_en,
                       spec_stats_html, spec_stats_html_en, trust_badges_html,
                       trust_badges_html_en, quick_answer_summary, quick_answer_summary_en,
                       faqs::text, commitments::text, highlights::text,
                       image_id, seo_og_image_id
                FROM products
                """,
                """
                SELECT image_url, image_id
                FROM product_variants
                """,
                """
                SELECT image_url, video_url, image_id
                FROM product_variant_gallery_images
                """,
                """
                SELECT image_url, icon_url, menu_icon_url,
                       banner_url, intro_content, intro_content_en,
                       description, description_en, seo_og_image_url,
                       image_id, icon_id, seo_og_image_id
                FROM categories
                """,
                """
                SELECT logo_url, banner_url, description,
                       description_en, seo_og_image_url, logo_id,
                       seo_og_image_id
                FROM brands
                """,
                """
                SELECT cover_image_url, product_image_url, seo_og_image_url,
                       body, body_en, body_blocks::text,
                       cover_image_id, seo_og_image_id
                FROM articles
                """,
                """
                SELECT video_url, thumbnail::text
                FROM home_videos
                """,
                """
                SELECT COALESCE(desktop_image::text,'') || ' ' || COALESCE(mobile_image::text,'')
                FROM sliders
                """,
                """
                SELECT url
                FROM menu_items
                """,
                """
                SELECT setting_value, setting_value_en, description
                FROM site_settings
                """,
                """
                SELECT photos::text
                FROM reviews
                """,
                """
                SELECT product_image_url, product_image_id
                FROM cart_items
                """,
                """
                SELECT image_url
                FROM order_line_items
                """,
        };
        List<String> blobs = new ArrayList<>();
        for (String sql : queries) {
            jdbc.query(sql, (RowCallbackHandler) rs -> {
                int columns = rs.getMetaData().getColumnCount();
                for (int column = 1; column <= columns; column++) {
                    String value = rs.getString(column);
                    if (value != null && !value.isEmpty()) blobs.add(value);
                }
            });
        }
        return blobs;
    }

    /**
     * products.gallery is JSONB (V334/V335/V336) — jsonb_array_elements/LATERAL isn't portable
     * to the H2 (MODE=PostgreSQL) test datasource, so gallery image URLs are extracted in Java
     * instead of via a native jsonb path expression, same spirit as the sliders blob check below.
     */
    private void collectGalleryReferences(List<MediaReferenceItem> target, String filePath) {
        jdbc.query("SELECT id, name, gallery::text AS gallery FROM products WHERE gallery IS NOT NULL", rs -> {
            String id = rs.getString("id");
            String name = rs.getString("name");
            for (String url : extractGalleryImageUrls(rs.getString("gallery"))) {
                if (url != null && url.endsWith(filePath)) {
                    target.add(new MediaReferenceItem("PRODUCT_GALLERY", id, name, "/admin/products/" + id));
                }
            }
        });
    }

    /** Parses a {@code products.gallery} JSON array and returns each item's {@code image.url} (skips videos without an image). */
    private List<String> extractGalleryImageUrls(String galleryJson) {
        if (galleryJson == null || galleryJson.isBlank()) return List.of();
        try {
            JsonNode array = MAPPER.readTree(galleryJson);
            List<String> urls = new ArrayList<>();
            if (array.isArray()) {
                for (JsonNode item : array) {
                    JsonNode urlNode = item.path("image").path("url");
                    if (urlNode.isTextual()) {
                        urls.add(urlNode.asText());
                    }
                }
            }
            return urls;
        } catch (Exception e) {
            return List.of();
        }
    }
}
