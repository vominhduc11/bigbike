package com.bigbike.bigbike_backend.migration.wordpress.live;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.SerializationFeature;
import tools.jackson.databind.json.JsonMapper;

/** Stable hashes used to bind an execution to the exact reviewed preflight plan. */
final class LiveMigrationPlanDigest {

    private final ObjectMapper mapper = JsonMapper.builder()
            .enable(MapperFeature.SORT_PROPERTIES_ALPHABETICALLY)
            .enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
            .build();

    String digest(LiveMigrationPreflightReport report) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("metadata", report.metadata());
        payload.put("ownerDecisions", report.ownerDecisions());
        payload.put("sourceCounts", report.sourceCounts());
        payload.put("targetCounts", report.targetCounts());
        payload.put("productActions", report.productActions());
        payload.put("variantActions", report.variantActions());
        payload.put("articleActions", report.articleActions());
        payload.put("mediaSummary", report.mediaSummary());
        payload.put("redirectSummary", report.redirectSummary());
        payload.put("seoSummary", report.seoSummary());
        payload.put("targetContentRewriteSummary", report.targetContentRewriteSummary());
        payload.put("products", report.products());
        payload.put("variants", report.variants());
        payload.put("articles", report.articles());
        payload.put("media", report.media());
        payload.put("targetMediaChecksums", report.targetMediaChecksums());
        payload.put("targetContentRewrites", report.targetContentRewrites());
        payload.put("redirects", report.redirects());
        payload.put("issues", report.issues());
        payload.put("blockers", report.blockers());
        return sha256(mapper.writeValueAsBytes(payload));
    }

    String fileSha256(Path path) throws Exception {
        return sha256(Files.readAllBytes(path));
    }

    private String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
}
