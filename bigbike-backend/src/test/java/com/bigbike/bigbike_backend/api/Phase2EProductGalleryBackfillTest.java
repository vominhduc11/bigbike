package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.BufferedReader;
import java.io.FileReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Phase 2E — One-time backfill: populate product_gallery_images from the WP dump.
 *
 * Reads _product_image_gallery postmeta directly from the SQL dump, joins with
 * the existing products and media tables, and inserts into product_gallery_images.
 * This is faster and safer than re-running the full import service (avoids
 * AttributeImporter duplicate key issues on re-run).
 *
 * HOW TO RUN (once, on dev/staging against the real PostgreSQL):
 *   ./mvnw.cmd test -Dtest=Phase2EProductGalleryBackfillTest#backfill_productGalleryImages \
 *     -Dgallery.backfill=true \
 *     -Dspring.datasource.url=jdbc:postgresql://localhost:5432/bigbike \
 *     -Dspring.datasource.username=bigbike \
 *     -Dspring.datasource.password=bigbike_dev_only \
 *     -Dspring.datasource.driver-class-name=org.postgresql.Driver \
 *     -Dspring.flyway.enabled=false \
 *     -Dspring.jpa.hibernate.ddl-auto=none \
 *     -Dspring.jpa.database-platform=org.hibernate.dialect.PostgreSQLDialect
 */
@SpringBootTest
class Phase2EProductGalleryBackfillTest {

    static final Path REAL_DUMP = Path.of("../bigbike_vn__2026_04_17/sqldump.sql");
    static final String TABLE_PREFIX = "kd_";

    @Autowired JdbcTemplate jdbc;

    private boolean dumpPresent;
    private boolean backfillEnabled;

    @BeforeEach
    void setup() {
        dumpPresent = Files.exists(REAL_DUMP);
        backfillEnabled = "true".equalsIgnoreCase(System.getProperty("gallery.backfill"));
    }

    @Test
    void backfill_productGalleryImages() throws Exception {
        if (!dumpPresent || !backfillEnabled) {
            assertThat(true).isTrue();
            return;
        }

        // 1. Parse dump: postId → comma-separated gallery attachment IDs
        Map<Long, String> galleryMetaByPostId = parseGalleryMeta(REAL_DUMP);
        System.out.printf("[Backfill] Found %d products with _product_image_gallery in dump%n",
                galleryMetaByPostId.size());

        // 2. Load product DB id → WP legacy_id mapping
        Map<Long, String> productIdByLegacyId = new LinkedHashMap<>();
        jdbc.query(
                "SELECT id, legacy_id::bigint FROM products WHERE legacy_id IS NOT NULL AND legacy_id ~ '^[0-9]+$'",
                rs -> { productIdByLegacyId.put(rs.getLong("legacy_id"), rs.getString("id")); });

        // 3. Load media public_url → WP legacy_id mapping
        Map<Long, String> mediaUrlByLegacyId = new LinkedHashMap<>();
        jdbc.query(
                "SELECT legacy_id, public_url FROM media WHERE legacy_id IS NOT NULL AND public_url IS NOT NULL",
                rs -> { mediaUrlByLegacyId.put(rs.getLong("legacy_id"), rs.getString("public_url")); });

        System.out.printf("[Backfill] DB: %d products, %d media entries%n",
                productIdByLegacyId.size(), mediaUrlByLegacyId.size());

        // 4. Build gallery rows and insert
        int inserted = 0, skipped = 0;
        for (Map.Entry<Long, String> e : galleryMetaByPostId.entrySet()) {
            Long wpPostId = e.getKey();
            String productId = productIdByLegacyId.get(wpPostId);
            if (productId == null) { skipped++; continue; }

            String[] idStrs = e.getValue().split(",");
            int sortOrder = 0;
            for (String idStr : idStrs) {
                String trimmed = idStr.trim();
                if (trimmed.isEmpty()) continue;
                long attachmentId;
                try { attachmentId = Long.parseLong(trimmed); } catch (NumberFormatException ex) { continue; }

                String url = mediaUrlByLegacyId.get(attachmentId);
                if (url == null || url.isBlank()) { skipped++; continue; }

                // Skip if URL equals product's main image (already in image_url field)
                String mainUrl = jdbc.queryForObject(
                        "SELECT image_url FROM products WHERE id = ?", String.class, productId);
                if (url.equals(mainUrl)) { sortOrder++; continue; }

                // Upsert: skip if already exists for this product+imageId
                int count = jdbc.queryForObject(
                        "SELECT COUNT(*) FROM product_gallery_images WHERE product_id = ? AND image_id = ?",
                        Integer.class, productId, String.valueOf(attachmentId));
                if (count > 0) { sortOrder++; continue; }

                jdbc.update(
                        "INSERT INTO product_gallery_images (product_id, image_id, image_url, sort_order) VALUES (?, ?, ?, ?)",
                        productId, String.valueOf(attachmentId), url, sortOrder);
                inserted++;
                sortOrder++;
            }
        }

        long total = jdbc.queryForObject("SELECT COUNT(*) FROM product_gallery_images", Long.class);
        System.out.printf("[Backfill] inserted=%d skipped=%d | total gallery rows=%d%n",
                inserted, skipped, total);

        assertThat(total).as("product_gallery_images must have rows after backfill").isGreaterThan(0);
    }

    /**
     * Extract postId → raw gallery value from kd_postmeta in the dump.
     * The dump uses multi-row INSERT: the INSERT header is on one line, then each
     * value row is on its own line as "(col1,col2,'key','value'),".
     * We track state to know when we're inside the kd_postmeta table block.
     */
    private Map<Long, String> parseGalleryMeta(Path dump) throws Exception {
        Map<Long, String> result = new LinkedHashMap<>();
        String postmetaTable = "`" + TABLE_PREFIX + "postmeta`";
        boolean inPostmeta = false;
        try (BufferedReader reader = new BufferedReader(new FileReader(dump.toFile()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                // Detect start of kd_postmeta INSERT block
                if (line.startsWith("INSERT INTO " + postmetaTable)) {
                    inPostmeta = true;
                    // The INSERT header line may also contain the first VALUES row
                    if (line.contains(" VALUES ")) {
                        String values = line.substring(line.indexOf(" VALUES ") + 8);
                        parsePostmetaRows(values, result);
                    }
                    continue;
                }
                // Detect end of INSERT block (empty line, new statement, etc.)
                if (inPostmeta && (line.isBlank() || line.startsWith("INSERT INTO") || line.startsWith("--") || line.startsWith("CREATE") || line.startsWith("ALTER") || line.startsWith("DROP"))) {
                    inPostmeta = false;
                }
                // Value rows inside the block: "(meta_id,post_id,'key','value'),"
                if (inPostmeta && line.startsWith("(")) {
                    parsePostmetaRows(line, result);
                }
            }
        }
        return result;
    }

    private void parsePostmetaRows(String text, Map<Long, String> result) {
        for (String row : splitInsertRows(text)) {
            String[] cols = splitCsvRow(row);
            if (cols.length < 4) continue;
            String metaKey = unquote(cols[2]);
            if (!"_product_image_gallery".equals(metaKey)) continue;
            String metaValue = unquote(cols[3]);
            if (metaValue == null || metaValue.isBlank()) continue;
            try {
                long postId = Long.parseLong(cols[1].trim());
                result.put(postId, metaValue);
            } catch (NumberFormatException ignored) { /* skip */ }
        }
    }

    private List<String> splitInsertRows(String values) {
        List<String> rows = new ArrayList<>();
        int depth = 0, start = -1;
        for (int i = 0; i < values.length(); i++) {
            char c = values.charAt(i);
            if (c == '(' && depth++ == 0) start = i + 1;
            else if (c == ')' && --depth == 0 && start >= 0) {
                rows.add(values.substring(start, i));
                start = -1;
            }
        }
        return rows;
    }

    private String[] splitCsvRow(String row) {
        List<String> cols = new ArrayList<>();
        boolean inQuote = false;
        StringBuilder cur = new StringBuilder();
        for (int i = 0; i < row.length(); i++) {
            char c = row.charAt(i);
            if (c == '\'' && (i == 0 || row.charAt(i - 1) != '\\')) {
                inQuote = !inQuote;
                cur.append(c);
            } else if (c == ',' && !inQuote) {
                cols.add(cur.toString().trim());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        cols.add(cur.toString().trim());
        return cols.toArray(new String[0]);
    }

    private String unquote(String s) {
        if (s == null) return null;
        s = s.trim();
        if (s.startsWith("'") && s.endsWith("'")) s = s.substring(1, s.length() - 1);
        return s.replace("\\'", "'").replace("\\\\", "\\");
    }
}
