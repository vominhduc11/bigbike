package com.bigbike.bigbike_backend.service.chat;

import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import java.sql.DriverManager;
import java.util.UUID;
import tools.jackson.databind.ObjectMapper;

/** Explicit owner command only: no Spring context, Flyway, scheduler, HTTP server or Gemini. */
public final class CatalogImageReindexCommand {
    private CatalogImageReindexCommand() {}

    public static void main(String[] args) throws Exception {
        if (args.length != 1 || !("verify".equals(args[0]) || "reindex".equals(args[0]))) {
            System.err.println("Usage: CatalogImageReindexCommand verify|reindex (see IMAGE_ASSISTANT_OPERATIONS.md)");
            System.exit(2);
        }
        boolean write = "reindex".equals(args[0]);
        String bucket = required("BIGBIKE_IMAGE_INDEX_MINIO_BUCKET");
        var minio = MinioClient.builder().endpoint(required("BIGBIKE_IMAGE_INDEX_MINIO_ENDPOINT"))
                .credentials(required("BIGBIKE_IMAGE_INDEX_MINIO_ACCESS_KEY"), required("BIGBIKE_IMAGE_INDEX_MINIO_SECRET_KEY"))
                .build();
        minio.setTimeout(5_000, 15_000, 15_000);
        int active = 0, readable = 0, indexed = 0, missing = 0, failed = 0;
        try (var connection = DriverManager.getConnection(required("BIGBIKE_IMAGE_INDEX_JDBC_URL"),
                required("BIGBIKE_IMAGE_INDEX_JDBC_USER"), required("BIGBIKE_IMAGE_INDEX_JDBC_PASSWORD"))) {
            // Only public catalog tables and the catalog index; no customer/media-chat tables.
            String sql = """
                    select p.id as product_id, m.id as media_id, m.file_path, m.bucket,
                           m.sizes, m.content_sha256,
                           f.source_version_hash, f.fingerprint_version, f.image_ref, f.dhash_hex, f.color_histogram, f.aspect_ratio
                    from products p
                    left join lateral (
                        select m.* from media m
                        where m.storage_provider = 'MINIO' and m.status = 'ACTIVE'
                          and (m.id::text = p.image_id or m.legacy_id::text = p.image_id
                            or m.public_url = p.image_url
                            or m.file_path = split_part(regexp_replace(p.image_url, '^.*/media/', ''), '?', 1))
                        order by (m.id::text = p.image_id) desc nulls last, m.id limit 1
                    ) m on true
                    left join chat_product_image_fingerprints f on f.product_id = p.id and f.fingerprint_version = 'local-visual-v1'
                    where p.publish_status = 'PUBLISHED' and not p.discontinued and upper(p.currency) = 'VND' and p.retail_price > 0
                    order by p.id
                    """;
            try (var query = connection.createStatement()) {
                query.setQueryTimeout(30);
                try (var rows = query.executeQuery(sql)) {
                    while (rows.next()) {
                        active++;
                        String productId = rows.getString("product_id");
                        String key = rows.getString("file_path");
                        String sourceHash = rows.getString("content_sha256");
                        if (key == null || key.startsWith("chat/") || key.contains("..")
                                || rows.getString("bucket") != null && !bucket.equals(rows.getString("bucket"))
                                || sourceHash == null || !sourceHash.matches("[a-fA-F0-9]{64}")) {
                            missing++;
                            System.out.println("UNRESOLVED product=" + productId);
                            continue;
                        }
                        try {
                            String readKey = key;
                            String sizes = rows.getString("sizes");
                            if (sizes != null) {
                                String thumb = new ObjectMapper().readTree(sizes).path("thumb").asString("");
                                int prefix = thumb.indexOf("/media/");
                                if (prefix >= 0) readKey = thumb.substring(prefix + 7).split("[?#]", 2)[0];
                            }
                            if (readKey.startsWith("chat/") || readKey.contains("..")) throw new IllegalArgumentException("Invalid public key");
                            byte[] bytes;
                            try (var input = minio.getObject(GetObjectArgs.builder().bucket(bucket).object(readKey).build())) {
                                bytes = input.readNBytes(16 * 1024 * 1024 + 1);
                            }
                            if (bytes.length > 16 * 1024 * 1024) throw new IllegalArgumentException("Image too large");
                            var descriptor = ChatProductImageFingerprintService.indexDescriptor(bytes)
                                    .orElseThrow(() -> new IllegalArgumentException("Undecodable image"));
                            readable++;
                            if (write) {
                                try (var save = connection.prepareStatement("""
                                        insert into chat_product_image_fingerprints
                                          (id, product_id, media_id, image_ref, source_version_hash, fingerprint_version,
                                           dhash_hex, color_histogram, aspect_ratio, indexed_at)
                                        values (?, ?, ?, ?, ?, ?, ?, ?, ?, now())
                                        on conflict (product_id, fingerprint_version) do update set
                                          media_id=excluded.media_id, image_ref=excluded.image_ref,
                                          source_version_hash=excluded.source_version_hash, dhash_hex=excluded.dhash_hex,
                                          color_histogram=excluded.color_histogram, aspect_ratio=excluded.aspect_ratio, indexed_at=now()
                                        """)) {
                                    save.setObject(1, UUID.randomUUID()); save.setString(2, productId);
                                    save.setObject(3, rows.getObject("media_id")); save.setString(4, key);
                                    save.setString(5, sourceHash.toLowerCase(java.util.Locale.ROOT)); save.setString(6, descriptor.version());
                                    save.setString(7, descriptor.dHashHex()); save.setString(8, descriptor.colorHistogram());
                                    save.setBigDecimal(9, descriptor.aspectRatio()); save.executeUpdate();
                                    indexed++;
                                }
                            } else if (sourceHash.equalsIgnoreCase(rows.getString("source_version_hash"))
                                    && descriptor.version().equals(rows.getString("fingerprint_version"))
                                    && key.equals(rows.getString("image_ref"))
                                    && descriptor.dHashHex().equals(rows.getString("dhash_hex"))
                                    && descriptor.colorHistogram().equals(rows.getString("color_histogram"))
                                    && descriptor.aspectRatio().compareTo(rows.getBigDecimal("aspect_ratio")) == 0) indexed++;
                        } catch (Exception error) {
                            failed++;
                            System.out.println("FAILED product=" + productId + " type=" + error.getClass().getSimpleName());
                        }
                    }
                }
            }
        }
        System.out.printf("active=%d readable=%d indexed=%d unresolved=%d failed=%d%n", active, readable, indexed, missing, failed);
        if (failed > 0 || indexed < active) System.exit(1);
    }

    private static String required(String name) {
        String value = System.getenv(name);
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Missing " + name);
        return value;
    }
}
