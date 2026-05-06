package com.bigbike.bigbike_backend.service.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * Checks whether a media asset's public URL is referenced by any other content tables.
 * Used to block hard-delete when references exist (P0-5).
 *
 * References are stored as plain URL strings (no FK), so detection is by value equality
 * against each known URL column. Slider images are stored as JSON, so a LIKE search is used.
 */
@Service
public class MediaReferenceService {

    private final JdbcTemplate jdbc;

    public MediaReferenceService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Returns true if {@code publicUrl} appears in any referencing table.
     * All table and column names are compile-time constants — no user input reaches them.
     */
    public boolean hasReferences(String publicUrl) {
        if (publicUrl == null || publicUrl.isBlank()) {
            return false;
        }
        return existsInColumn("products", "image_url", publicUrl)
                || existsInColumn("product_gallery_images", "image_url", publicUrl)
                || existsInColumn("product_variants", "image_url", publicUrl)
                || existsInColumn("product_variant_gallery_images", "image_url", publicUrl)
                || existsInColumn("categories", "image_url", publicUrl)
                || existsInColumn("brands", "logo_url", publicUrl)
                || existsInColumn("home_videos", "video_url", publicUrl)
                || existsInColumn("articles", "cover_image_url", publicUrl)
                || existsInColumn("articles", "product_image_url", publicUrl)
                || existsInColumn("articles", "seo_og_image_url", publicUrl)
                || existsInColumn("pages", "seo_og_image_url", publicUrl)
                || existsInJsonColumn("sliders", "desktop_image", publicUrl)
                || existsInJsonColumn("sliders", "mobile_image", publicUrl);
    }

    private boolean existsInColumn(String table, String column, String url) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?",
                Integer.class, url);
        return count != null && count > 0;
    }

    private boolean existsInJsonColumn(String table, String column, String url) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE " + column + " LIKE ?",
                Integer.class, "%" + url + "%");
        return count != null && count > 0;
    }
}
