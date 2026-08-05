package com.bigbike.bigbike_backend.migration.wordpress.live;

import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Validates the operator-produced proof that rollback backups live outside this VPS. */
final class LiveOffsiteBackupManifestValidator {

    static final Set<String> REQUIRED_KINDS = Set.of(
            "SOURCE_DATABASE",
            "SOURCE_UPLOADS",
            "TARGET_DATABASE",
            "TARGET_MEDIA_METADATA",
            "NGINX_CONFIG",
            "DEPLOYMENT_CONFIG");
    private static final Duration MINIMUM_RETENTION = Duration.ofDays(30);
    private static final Duration MAXIMUM_VERIFICATION_AGE = Duration.ofHours(24);

    Validation validate(
            Path manifestPath,
            String expectedSnapshotId,
            String expectedSourceDumpSha256,
            Instant now) {
        List<String> errors = new ArrayList<>();
        if (manifestPath == null || !Files.isRegularFile(manifestPath)
                || !Files.isReadable(manifestPath)) {
            return new Validation(false, false, List.of("Manifest is missing or unreadable"));
        }

        JsonNode root;
        try {
            root = new ObjectMapper().readTree(Files.readString(manifestPath));
        } catch (Exception e) {
            return new Validation(true, false, List.of("Manifest is not valid JSON"));
        }
        if (root == null || !root.isObject()) {
            return new Validation(true, false, List.of("Manifest root must be a JSON object"));
        }

        if (root.path("version").asInt(-1) != 1) errors.add("version must equal 1");
        if (!expectedSnapshotId.equals(text(root, "snapshotId"))) {
            errors.add("snapshotId does not match this preflight snapshot");
        }
        if (!expectedSourceDumpSha256.equals(text(root, "sourceDumpSha256"))) {
            errors.add("sourceDumpSha256 does not match the selected dump");
        }

        Instant retentionUntil = instant(root, "retentionUntil", errors);
        if (retentionUntil != null && retentionUntil.isBefore(now.plus(MINIMUM_RETENTION))) {
            errors.add("retentionUntil must be at least 30 days in the future");
        }
        Instant verifiedAt = instant(root, "verifiedReadableAt", errors);
        if (verifiedAt != null && (verifiedAt.isBefore(now.minus(MAXIMUM_VERIFICATION_AGE))
                || verifiedAt.isAfter(now.plus(Duration.ofMinutes(5))))) {
            errors.add("verifiedReadableAt must be within the last 24 hours");
        }

        JsonNode artifacts = root.path("artifacts");
        Map<String, JsonNode> byKind = new HashMap<>();
        Set<String> duplicateKinds = new LinkedHashSet<>();
        if (!artifacts.isArray()) {
            errors.add("artifacts must be an array");
        } else {
            for (JsonNode artifact : artifacts) {
                String kind = text(artifact, "kind");
                if (kind == null) {
                    errors.add("Every artifact requires kind");
                    continue;
                }
                if (byKind.putIfAbsent(kind, artifact) != null) duplicateKinds.add(kind);
            }
        }
        if (!duplicateKinds.isEmpty()) errors.add("Duplicate artifact kinds: " + duplicateKinds);

        for (String kind : REQUIRED_KINDS) {
            JsonNode artifact = byKind.get(kind);
            if (artifact == null) {
                errors.add("Missing required offsite artifact: " + kind);
                continue;
            }
            validateArtifact(kind, artifact, errors);
        }
        JsonNode sourceDb = byKind.get("SOURCE_DATABASE");
        if (sourceDb != null && !expectedSourceDumpSha256.equals(text(sourceDb, "sha256"))) {
            errors.add("SOURCE_DATABASE sha256 does not match the selected dump");
        }
        return new Validation(true, errors.isEmpty(), List.copyOf(errors));
    }

    private void validateArtifact(String kind, JsonNode artifact, List<String> errors) {
        String location = text(artifact, "location");
        if (!isOffsiteLocation(location)) {
            errors.add(kind + " location must be an external URI without embedded credentials");
        }
        String sha256 = text(artifact, "sha256");
        if (sha256 == null || !sha256.matches("[0-9a-f]{64}")) {
            errors.add(kind + " sha256 must be a lowercase SHA-256");
        }
        if (artifact.path("bytes").asLong(0) <= 0) errors.add(kind + " bytes must be greater than 0");
        if (!artifact.path("verifiedReadable").asBoolean(false)) {
            errors.add(kind + " must be marked verifiedReadable=true");
        }
    }

    private boolean isOffsiteLocation(String value) {
        if (value == null) return false;
        try {
            URI uri = URI.create(value);
            if (uri.getScheme() == null || "file".equalsIgnoreCase(uri.getScheme())) return false;
            if (uri.getUserInfo() != null) return false;
            String host = uri.getHost();
            return host == null || (!"localhost".equalsIgnoreCase(host)
                    && !host.startsWith("127.") && !"::1".equals(host));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private Instant instant(JsonNode root, String field, List<String> errors) {
        String value = text(root, field);
        if (value == null) {
            errors.add(field + " is required");
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (RuntimeException e) {
            errors.add(field + " must be an ISO-8601 instant");
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return null;
        String value = node.path(field).asText("").trim();
        return value.isEmpty() ? null : value;
    }

    record Validation(boolean present, boolean valid, List<String> errors) {}
}
