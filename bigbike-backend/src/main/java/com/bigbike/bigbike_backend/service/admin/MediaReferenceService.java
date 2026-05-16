package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.media.MediaReferenceItem;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
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

        List<MediaReferenceItem> refs = new ArrayList<>();

        collectLike(refs, "SELECT id::text, name FROM products WHERE image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT", rs.getString(1), rs.getString(2), "/products/" + rs.getString(1)));

        collectLike(refs, "SELECT p.id::text, p.name FROM product_gallery_images g JOIN products p ON p.id = g.product_id WHERE g.image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT_GALLERY", rs.getString(1), rs.getString(2), "/products/" + rs.getString(1)));

        collectLike(refs,
                "SELECT v.id::text, COALESCE(p.name,'') || ' / ' || COALESCE(v.sku, v.id::text) AS label, p.id::text " +
                "FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT_VARIANT", rs.getString(1), rs.getString(2), "/products/" + rs.getString(3)));

        collectLike(refs,
                "SELECT v.id::text, COALESCE(p.name,'') || ' / ' || COALESCE(v.sku, v.id::text) AS label, p.id::text " +
                "FROM product_variant_gallery_images g JOIN product_variants v ON v.id = g.variant_id JOIN products p ON p.id = v.product_id WHERE g.image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PRODUCT_VARIANT_GALLERY", rs.getString(1), rs.getString(2), "/products/" + rs.getString(3)));

        collectLike(refs, "SELECT id::text, name FROM categories WHERE image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CATEGORY", rs.getString(1), rs.getString(2), "/categories/" + rs.getString(1)));

        collectLike(refs, "SELECT id::text, name FROM brands WHERE logo_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("BRAND", rs.getString(1), rs.getString(2), "/brands/" + rs.getString(1)));

        collectLike(refs, "SELECT id::text, title FROM home_videos WHERE video_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("HOME_VIDEO", rs.getString(1), rs.getString(2), "/home-videos"));

        collectLike(refs, "SELECT id::text, title FROM articles WHERE cover_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CONTENT", rs.getString(1), rs.getString(2), "/content/" + rs.getString(1)));

        collectLike(refs, "SELECT id::text, title FROM articles WHERE product_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CONTENT_PRODUCT_IMG", rs.getString(1), rs.getString(2), "/content/" + rs.getString(1)));

        collectLike(refs, "SELECT id::text, title FROM articles WHERE seo_og_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("CONTENT_SEO_OG", rs.getString(1), rs.getString(2), "/content/" + rs.getString(1)));

        collectLike(refs, "SELECT id::text, title FROM pages WHERE seo_og_image_url LIKE ?",
                suffix, rs -> new MediaReferenceItem("PAGE_SEO_OG", rs.getString(1), rs.getString(2), "/content/" + rs.getString(1)));

        // Sliders: file_path may appear anywhere inside the JSON blob (not necessarily at the end)
        String anywhere = "%" + media.getFilePath() + "%";
        collectLike(refs, "SELECT id::text, COALESCE(location,'') FROM sliders WHERE desktop_image::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("SLIDER_DESKTOP", rs.getString(1), "Banner desktop – " + rs.getString(2), "/sliders"));

        collectLike(refs, "SELECT id::text, COALESCE(location,'') FROM sliders WHERE mobile_image::text LIKE ?",
                anywhere, rs -> new MediaReferenceItem("SLIDER_MOBILE", rs.getString(1), "Banner mobile – " + rs.getString(2), "/sliders"));

        return refs;
    }

    /**
     * Returns the subset of {@code candidates} (by id) that are referenced by at least
     * one other row in the database. Matches on {@code file_path} suffix to handle
     * both relative and absolute legacy URLs.
     *
     * <p>Cost is O(tables × N): each table is scanned once and a substring match runs
     * against every candidate file_path. For the typical media library size this beats
     * issuing 13 queries per item.
     */
    public Set<java.util.UUID> getUsedMediaIds(Collection<MediaEntity> candidates) {
        if (candidates == null || candidates.isEmpty()) return Set.of();

        // Build (id, file_path) tuples once, skipping anything without a usable file_path
        record IdPath(java.util.UUID id, String filePath) {}
        List<IdPath> tuples = candidates.stream()
                .filter(m -> m.getFilePath() != null && !m.getFilePath().isBlank())
                .map(m -> new IdPath(m.getId(), m.getFilePath()))
                .toList();
        if (tuples.isEmpty()) return Set.of();

        Set<java.util.UUID> used = new HashSet<>();

        // For equality-style columns (everything except sliders), pull all distinct
        // referenced URLs once and substring-match against each candidate file_path
        // in Java. Each table scan returns at most O(rows) URLs, which is small
        // compared to running an indexed LIKE per candidate.
        String[] columnQueries = {
                "SELECT DISTINCT image_url FROM products WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT DISTINCT image_url FROM product_gallery_images WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT DISTINCT image_url FROM product_variants WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT DISTINCT image_url FROM product_variant_gallery_images WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT DISTINCT image_url FROM categories WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT DISTINCT logo_url FROM brands WHERE logo_url IS NOT NULL AND logo_url <> ''",
                "SELECT DISTINCT video_url FROM home_videos WHERE video_url IS NOT NULL AND video_url <> ''",
                "SELECT DISTINCT cover_image_url FROM articles WHERE cover_image_url IS NOT NULL AND cover_image_url <> ''",
                "SELECT DISTINCT product_image_url FROM articles WHERE product_image_url IS NOT NULL AND product_image_url <> ''",
                "SELECT DISTINCT seo_og_image_url FROM articles WHERE seo_og_image_url IS NOT NULL AND seo_og_image_url <> ''",
                "SELECT DISTINCT seo_og_image_url FROM pages WHERE seo_og_image_url IS NOT NULL AND seo_og_image_url <> ''",
                "SELECT COALESCE(desktop_image::text,'') || ' ' || COALESCE(mobile_image::text,'') FROM sliders",
        };

        // Collect all referenced URL/JSON blobs into one list
        List<String> referencedBlobs = new ArrayList<>();
        for (String sql : columnQueries) {
            referencedBlobs.addAll(jdbc.query(sql, (rs, rowNum) -> rs.getString(1)));
        }

        // For each candidate, mark as used if any referenced blob ends with /
        // contains its file_path
        for (IdPath tuple : tuples) {
            for (String blob : referencedBlobs) {
                if (blob != null && blob.contains(tuple.filePath())) {
                    used.add(tuple.id());
                    break;
                }
            }
        }

        return used;
    }

    /**
     * Computes a usageCount per media in the input list, in O(tables × N) instead of
     * O(N × 13 queries). Reuses the same blob-collection strategy as
     * {@link #getUsedMediaIds(Collection)} but counts all matches instead of stopping at first.
     */
    public java.util.Map<java.util.UUID, Integer> getUsageCounts(Collection<MediaEntity> candidates) {
        if (candidates == null || candidates.isEmpty()) return java.util.Map.of();

        record IdPath(java.util.UUID id, String filePath) {}
        List<IdPath> tuples = candidates.stream()
                .filter(m -> m.getFilePath() != null && !m.getFilePath().isBlank())
                .map(m -> new IdPath(m.getId(), m.getFilePath()))
                .toList();
        if (tuples.isEmpty()) return java.util.Map.of();

        String[] columnQueries = {
                "SELECT image_url FROM products WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT image_url FROM product_gallery_images WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT image_url FROM product_variants WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT image_url FROM product_variant_gallery_images WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT image_url FROM categories WHERE image_url IS NOT NULL AND image_url <> ''",
                "SELECT logo_url FROM brands WHERE logo_url IS NOT NULL AND logo_url <> ''",
                "SELECT video_url FROM home_videos WHERE video_url IS NOT NULL AND video_url <> ''",
                "SELECT cover_image_url FROM articles WHERE cover_image_url IS NOT NULL AND cover_image_url <> ''",
                "SELECT product_image_url FROM articles WHERE product_image_url IS NOT NULL AND product_image_url <> ''",
                "SELECT seo_og_image_url FROM articles WHERE seo_og_image_url IS NOT NULL AND seo_og_image_url <> ''",
                "SELECT seo_og_image_url FROM pages WHERE seo_og_image_url IS NOT NULL AND seo_og_image_url <> ''",
                "SELECT COALESCE(desktop_image::text,'') || ' ' || COALESCE(mobile_image::text,'') FROM sliders",
        };

        List<String> referencedBlobs = new ArrayList<>();
        for (String sql : columnQueries) {
            referencedBlobs.addAll(jdbc.query(sql, (rs, rowNum) -> rs.getString(1)));
        }

        java.util.Map<java.util.UUID, Integer> counts = new java.util.HashMap<>();
        for (IdPath tuple : tuples) counts.put(tuple.id(), 0);
        for (IdPath tuple : tuples) {
            int c = 0;
            for (String blob : referencedBlobs) {
                if (blob != null && blob.contains(tuple.filePath())) c++;
            }
            counts.put(tuple.id(), c);
        }
        return counts;
    }

    @FunctionalInterface
    private interface RowMapper {
        MediaReferenceItem map(java.sql.ResultSet rs) throws java.sql.SQLException;
    }

    private void collectLike(List<MediaReferenceItem> target, String sql, String pattern, RowMapper mapper) {
        RowCallbackHandler handler = rs -> target.add(mapper.map(rs));
        jdbc.query(sql, handler, pattern);
    }
}
