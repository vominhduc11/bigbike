package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.MediaPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.MediaSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetMediaChecksumPlan;
import com.bigbike.bigbike_backend.migration.wordpress.media.MediaChecksumService;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetMedia;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import java.io.BufferedInputStream;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Plans referenced-only media transfer and content-hash reuse. */
final class LiveMediaPlanner {

    private final MediaChecksumService checksumService = new MediaChecksumService();

    Result plan(
            List<Reference> references,
            Path uploadsRoot,
            List<TargetMedia> targetMedia,
            String defaultBucket,
            boolean hashTargetMedia,
            MinioClient minioClient) {

        List<Issue> issues = new ArrayList<>();
        List<String> blockers = new ArrayList<>();
        Map<String, MutableSourceFile> filesByPath = new LinkedHashMap<>();
        int invalidPaths = 0;
        int missingFiles = 0;

        Path normalizedRoot = uploadsRoot.toAbsolutePath().normalize();
        for (Reference reference : references) {
            String normalized = normalizeRelativePath(reference.relativePath());
            if (normalized == null) {
                invalidPaths++;
                String detail = reference.attachmentId() == null
                        ? "inline path=" + String.valueOf(reference.relativePath())
                        : "attachment id=" + reference.attachmentId();
                issues.add(issue("BLOCKER", reference.sourceType(), reference.sourceId(),
                        "MEDIA_PATH_INVALID",
                        "Media path is empty, malformed, or escapes the uploads directory ("
                                + detail + ")"));
                continue;
            }
            MutableSourceFile file = filesByPath.computeIfAbsent(normalized,
                    path -> new MutableSourceFile(reference.attachmentId(), path));
            if (file.attachmentId == null && reference.attachmentId() != null) {
                file.attachmentId = reference.attachmentId();
            } else if (reference.attachmentId() != null
                    && !reference.attachmentId().equals(file.attachmentId)) {
                file.ambiguousAttachmentIds = true;
                file.reasons.add("Multiple attachment ids reference the same source path: "
                        + file.attachmentId + ", " + reference.attachmentId());
            }
            file.referencedBy.add(reference.sourceType() + ":" + reference.sourceId());
        }

        for (MutableSourceFile file : filesByPath.values()) {
            Path resolved = normalizedRoot.resolve(file.relativePath).normalize();
            if (!resolved.startsWith(normalizedRoot)) {
                file.reasons.add("Resolved path escapes uploads root");
                invalidPaths++;
                continue;
            }
            try {
                if (!Files.isRegularFile(resolved) || !Files.isReadable(resolved)) {
                    file.reasons.add("Source file is missing or unreadable");
                    missingFiles++;
                    continue;
                }
                file.fileSize = Files.size(resolved);
                file.sha256 = checksumService.sha256Hex(resolved);
            } catch (Exception e) {
                file.reasons.add("Cannot hash source file: " + safeMessage(e));
                missingFiles++;
            }
        }

        Map<String, List<TargetMedia>> targetBySha = new HashMap<>();
        Map<Long, List<TargetMedia>> targetByLegacyId = new HashMap<>();
        Map<String, String> verifiedShaByTargetId = new HashMap<>();
        List<TargetMediaChecksumPlan> targetChecksumPlans = new ArrayList<>();
        for (TargetMedia media : targetMedia) {
            if (media.legacyId() != null) {
                targetByLegacyId.computeIfAbsent(media.legacyId(), ignored -> new ArrayList<>()).add(media);
            }
        }
        int targetObjectsHashed = 0;
        int targetHashFailures = 0;
        int targetChecksumUpdates = 0;
        for (TargetMedia media : targetMedia) {
            String storedSha = isSha256(media.contentSha256()) ? media.contentSha256() : null;
            String bucket = firstNonBlank(media.bucket(), defaultBucket);
            String objectKey = targetObjectKey(media);
            if (!hashTargetMedia || minioClient == null) {
                if (storedSha != null) {
                    targetBySha.computeIfAbsent(storedSha, ignored -> new ArrayList<>()).add(media);
                    verifiedShaByTargetId.put(media.id(), storedSha);
                    targetChecksumPlans.add(new TargetMediaChecksumPlan(
                            media.id(), bucket, objectKey, storedSha, media.fileSize(), Action.PRESERVE,
                            List.of("Stored SHA-256 was not reverified because target hashing is disabled")));
                } else {
                    targetChecksumPlans.add(new TargetMediaChecksumPlan(
                            media.id(), bucket, objectKey, null, media.fileSize(), Action.CONFLICT,
                            List.of("Target SHA-256 is absent and object hashing is disabled")));
                }
                continue;
            }
            if (bucket == null || objectKey == null) {
                targetHashFailures++;
                issues.add(issue("ERROR", "MEDIA", media.id(), "TARGET_MEDIA_OBJECT_KEY_INVALID",
                        "Target media has no resolvable bucket/object key"));
                targetChecksumPlans.add(new TargetMediaChecksumPlan(
                        media.id(), bucket, objectKey, storedSha, media.fileSize(), Action.CONFLICT,
                        List.of("No resolvable bucket/object key")));
                continue;
            }
            try {
                ObjectDigest digest = hashObject(minioClient, bucket, objectKey);
                targetObjectsHashed++;
                List<String> reasons = new ArrayList<>();
                boolean conflict = false;
                if (storedSha != null && !storedSha.equals(digest.sha256())) {
                    conflict = true;
                    reasons.add("Stored SHA-256 differs from current object bytes");
                    issues.add(issue("CONFLICT", "MEDIA", media.id(), "TARGET_MEDIA_HASH_MISMATCH",
                            "Stored SHA-256 differs from current target object bytes"));
                }
                if (media.fileSize() != null && !media.fileSize().equals(digest.bytes())) {
                    conflict = true;
                    reasons.add("Stored file_size differs from current object bytes");
                    issues.add(issue("CONFLICT", "MEDIA", media.id(), "TARGET_MEDIA_SIZE_MISMATCH",
                            "Stored file_size differs from current target object bytes"));
                }
                Action checksumAction;
                if (conflict) {
                    checksumAction = Action.CONFLICT;
                } else if (storedSha == null || media.fileSize() == null) {
                    checksumAction = Action.UPDATE_FILL_BLANKS;
                    targetChecksumUpdates++;
                    reasons.add("Fill missing checksum/file size from verified target object");
                } else {
                    checksumAction = Action.PRESERVE;
                    reasons.add("Stored checksum and size match current target object");
                }
                targetChecksumPlans.add(new TargetMediaChecksumPlan(
                        media.id(), bucket, objectKey, digest.sha256(), digest.bytes(),
                        checksumAction, List.copyOf(reasons)));
                if (!conflict) {
                    targetBySha.computeIfAbsent(digest.sha256(), ignored -> new ArrayList<>()).add(media);
                    verifiedShaByTargetId.put(media.id(), digest.sha256());
                }
            } catch (Exception e) {
                targetHashFailures++;
                issues.add(issue("ERROR", "MEDIA", media.id(), "TARGET_MEDIA_HASH_FAILED",
                        "Could not verify target object checksum: " + objectKey + " (" + safeMessage(e) + ")"));
                targetChecksumPlans.add(new TargetMediaChecksumPlan(
                        media.id(), bucket, objectKey, storedSha, media.fileSize(), Action.CONFLICT,
                        List.of("Target object could not be read and hashed")));
            }
        }

        Set<String> duplicateTargetHashes = targetBySha.entrySet().stream()
                .filter(entry -> entry.getValue().size() > 1)
                .map(Map.Entry::getKey)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
        for (String duplicateSha : duplicateTargetHashes) {
            issues.add(issue("CONFLICT", "MEDIA", "", "TARGET_SHA_DUPLICATE",
                    "Multiple target media records share verified SHA-256 " + duplicateSha));
        }
        if (!duplicateTargetHashes.isEmpty()) {
            targetChecksumPlans = targetChecksumPlans.stream().map(plan -> {
                if (!duplicateTargetHashes.contains(plan.sha256())) return plan;
                List<String> reasons = new ArrayList<>(plan.reasons());
                reasons.add("Verified content is duplicated by another target media row");
                return new TargetMediaChecksumPlan(
                        plan.targetMediaId(), plan.bucket(), plan.objectKey(), plan.sha256(),
                        plan.objectBytes(), Action.CONFLICT, List.copyOf(reasons));
            }).toList();
        }
        targetChecksumUpdates = (int) targetChecksumPlans.stream()
                .filter(plan -> plan.action() == Action.UPDATE_FILL_BLANKS).count();

        List<MediaPlan> plans = new ArrayList<>();
        Map<String, String> plannedTargetBySha = new HashMap<>();
        long uniqueSourceBytes = 0;
        long bytesReused = 0;
        long bytesToCopy = 0;
        int reused = 0;
        int inserted = 0;

        for (MutableSourceFile file : filesByPath.values()) {
            if (file.ambiguousAttachmentIds) {
                issues.add(issue("CONFLICT", "MEDIA", stringId(file.attachmentId),
                        "SOURCE_MEDIA_PATH_ATTACHMENT_CONFLICT",
                        "Multiple WordPress attachment ids reference one source path"));
                plans.add(new MediaPlan(file.attachmentId, file.relativePath, file.sha256, file.fileSize,
                        null, Action.CONFLICT, List.copyOf(file.referencedBy),
                        List.copyOf(file.reasons)));
                continue;
            }
            if (!isSha256(file.sha256) || file.fileSize == null) {
                plans.add(new MediaPlan(file.attachmentId, file.relativePath, null, file.fileSize,
                        null, Action.SKIP, List.copyOf(file.referencedBy), List.copyOf(file.reasons)));
                continue;
            }
            uniqueSourceBytes += file.fileSize;
            List<TargetMedia> legacyMatches = file.attachmentId == null
                    ? List.of() : targetByLegacyId.getOrDefault(file.attachmentId, List.of());
            if (legacyMatches.size() > 1) {
                issues.add(issue("CONFLICT", "MEDIA", stringId(file.attachmentId),
                        "TARGET_LEGACY_MEDIA_DUPLICATE",
                        "Multiple target media records claim one WordPress attachment id"));
                plans.add(new MediaPlan(file.attachmentId, file.relativePath, file.sha256, file.fileSize,
                        null, Action.CONFLICT, List.copyOf(file.referencedBy),
                        List.of("Ambiguous target media legacy_id")));
                continue;
            }
            if (legacyMatches.size() == 1) {
                TargetMedia legacy = legacyMatches.get(0);
                String verifiedLegacySha = verifiedShaByTargetId.get(legacy.id());
                if (verifiedLegacySha == null || !file.sha256.equals(verifiedLegacySha)) {
                    issues.add(issue("CONFLICT", "MEDIA", stringId(file.attachmentId),
                            "TARGET_LEGACY_MEDIA_CONTENT_CONFLICT",
                            "Existing legacy_id points to different or unverifiable object bytes"));
                    plans.add(new MediaPlan(file.attachmentId, file.relativePath, file.sha256, file.fileSize,
                            legacy.id(), Action.CONFLICT, List.copyOf(file.referencedBy),
                            List.of("legacy_id exists but verified SHA-256 does not match source")));
                    continue;
                }
            }
            List<TargetMedia> existing = targetBySha.getOrDefault(file.sha256, List.of());
            if (existing.size() > 1) {
                issues.add(issue("CONFLICT", "MEDIA", stringId(file.attachmentId),
                        "TARGET_SHA_DUPLICATE", "Multiple target media records share SHA-256 " + file.sha256));
                plans.add(new MediaPlan(file.attachmentId, file.relativePath, file.sha256, file.fileSize,
                        null, Action.CONFLICT, List.copyOf(file.referencedBy),
                        List.of("Multiple target media records have identical content")));
                continue;
            }
            if (existing.size() == 1) {
                TargetMedia target = existing.get(0);
                reused++;
                bytesReused += file.fileSize;
                plans.add(new MediaPlan(file.attachmentId, file.relativePath, file.sha256, file.fileSize,
                        target.id(), Action.PRESERVE, List.copyOf(file.referencedBy),
                        List.of("Reuse existing target media by SHA-256")));
                plannedTargetBySha.putIfAbsent(file.sha256, target.id());
                continue;
            }

            String plannedTarget = plannedTargetBySha.get(file.sha256);
            if (plannedTarget != null) {
                reused++;
                bytesReused += file.fileSize;
                plans.add(new MediaPlan(file.attachmentId, file.relativePath, file.sha256, file.fileSize,
                        plannedTarget, Action.PRESERVE, List.copyOf(file.referencedBy),
                        List.of("Reuse another source file with identical SHA-256")));
                continue;
            }

            // media.id is UUID in the target schema. Derive it from content rather than
            // filename/attachment id so a retry and a duplicate source file converge on
            // the same valid primary key.
            plannedTarget = deterministicMediaId(file.sha256);
            plannedTargetBySha.put(file.sha256, plannedTarget);
            inserted++;
            bytesToCopy += file.fileSize;
            plans.add(new MediaPlan(file.attachmentId, file.relativePath, file.sha256, file.fileSize,
                    plannedTarget, Action.INSERT, List.copyOf(file.referencedBy),
                    List.of("Copy one object; persist verified SHA-256")));
        }

        if (missingFiles > 0) blockers.add("SOURCE_REFERENCED_MEDIA_MISSING");
        if (invalidPaths > 0) blockers.add("SOURCE_MEDIA_PATH_INVALID");
        if (targetHashFailures > 0) blockers.add("TARGET_MEDIA_HASH_INCOMPLETE");
        if (targetChecksumPlans.stream().anyMatch(plan -> plan.action() == Action.CONFLICT)) {
            blockers.add("TARGET_MEDIA_INTEGRITY_CONFLICTS");
        }
        if (plans.stream().anyMatch(plan -> plan.action() == Action.CONFLICT)) {
            blockers.add("MEDIA_CONFLICTS_PRESENT");
        }
        if ((!hashTargetMedia || minioClient == null) && !targetMedia.isEmpty()) {
            blockers.add("TARGET_MEDIA_HASHING_DISABLED");
        }

        MediaSummary summary = new MediaSummary(
                references.size(), filesByPath.size(), reused, inserted, missingFiles, invalidPaths,
                targetObjectsHashed, targetHashFailures, targetChecksumUpdates,
                duplicateTargetHashes.size(), uniqueSourceBytes, bytesReused, bytesToCopy);
        return new Result(List.copyOf(plans), List.copyOf(targetChecksumPlans), summary, List.copyOf(issues),
                List.copyOf(new LinkedHashSet<>(blockers)), bytesToCopy);
    }

    private ObjectDigest hashObject(MinioClient client, String bucket, String objectKey) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long bytes = 0;
        try (InputStream raw = client.getObject(
                     GetObjectArgs.builder().bucket(bucket).object(objectKey).build());
             InputStream in = new BufferedInputStream(raw, 64 * 1024)) {
            byte[] buffer = new byte[64 * 1024];
            int read;
            while ((read = in.read(buffer)) >= 0) {
                if (read > 0) {
                    digest.update(buffer, 0, read);
                    bytes += read;
                }
            }
        }
        return new ObjectDigest(HexFormat.of().formatHex(digest.digest()), bytes);
    }

    static String targetObjectKey(TargetMedia media) {
        String publicUrl = media.publicUrl();
        if (publicUrl != null && publicUrl.startsWith("/media/")) {
            return stripLeadingSlash(publicUrl.substring("/media/".length()));
        }
        if (media.filePath() == null || media.filePath().isBlank()) return null;
        String path = stripLeadingSlash(media.filePath().trim());
        if ("LEGACY_WP".equalsIgnoreCase(media.storageProvider()) && !path.startsWith("wp-uploads/")) {
            return "wp-uploads/" + path;
        }
        return path;
    }

    static String migrationObjectKey(String sha256, String relativePath) {
        if (!isSha256Static(sha256)) throw new IllegalArgumentException("A lowercase SHA-256 is required");
        String relative = normalizeRelativePath(relativePath);
        if (relative == null) throw new IllegalArgumentException("A safe relative media path is required");
        String fileName = sanitizeFileName(Path.of(relative).getFileName().toString());
        return "migration/wordpress/" + sha256.substring(0, 2)
                + "/" + sha256 + "/" + fileName;
    }

    private static String sanitizeFileName(String value) {
        String normalized = value == null ? "media.bin"
                : value.replaceAll("[^A-Za-z0-9._-]", "_").replaceAll("_+", "_");
        if (normalized.isBlank() || ".".equals(normalized) || "..".equals(normalized)) {
            normalized = "media.bin";
        }
        if (normalized.length() > 120) normalized = normalized.substring(normalized.length() - 120);
        return normalized;
    }

    static String normalizeRelativePath(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim().replace('\\', '/');
        int query = value.indexOf('?');
        if (query >= 0) value = value.substring(0, query);
        int fragment = value.indexOf('#');
        if (fragment >= 0) value = value.substring(0, fragment);
        int marker = value.indexOf("/wp-content/uploads/");
        if (marker >= 0) value = value.substring(marker + "/wp-content/uploads/".length());
        if (value.startsWith("wp-content/uploads/")) {
            value = value.substring("wp-content/uploads/".length());
        }
        value = stripLeadingSlash(value);
        try {
            // URLDecoder follows form semantics and otherwise turns a literal '+' path byte into
            // a space. Escape it first so only percent-encoding is decoded here.
            value = URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
        final Path sourcePath;
        final Path normalized;
        try {
            sourcePath = Path.of(value);
            normalized = sourcePath.normalize();
        } catch (RuntimeException ignored) {
            return null;
        }
        String result = normalized.toString().replace('\\', '/');
        if (result.isBlank() || result.equals(".") || result.equals("..")
                || result.startsWith("../") || sourcePath.isAbsolute()) {
            return null;
        }
        return result;
    }

    static String deterministicMediaId(String sha256) {
        if (!isSha256Static(sha256)) {
            throw new IllegalArgumentException("A lowercase SHA-256 is required");
        }
        return UUID.nameUUIDFromBytes(
                ("bigbike:wordpress-media:" + sha256).getBytes(StandardCharsets.UTF_8)).toString();
    }

    private static String stripLeadingSlash(String value) {
        String result = value;
        while (result.startsWith("/")) result = result.substring(1);
        return result;
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) return first;
        return second != null && !second.isBlank() ? second : null;
    }

    private boolean isSha256(String value) {
        return isSha256Static(value);
    }

    private static boolean isSha256Static(String value) {
        return value != null && value.matches("[0-9a-f]{64}");
    }

    private Issue issue(String severity, String domain, String sourceId, String code, String message) {
        return new Issue(severity, domain, sourceId == null ? "" : sourceId, code, message);
    }

    private String stringId(Long value) {
        return value == null ? "" : value.toString();
    }

    private String safeMessage(Exception e) {
        String value = e.getMessage();
        if (value == null || value.isBlank()) return e.getClass().getSimpleName();
        return value.length() > 240 ? value.substring(0, 240) : value;
    }

    record Reference(Long attachmentId, String relativePath, String sourceType, String sourceId) {}
    record Result(
            List<MediaPlan> plans,
            List<TargetMediaChecksumPlan> targetChecksumPlans,
            MediaSummary summary,
            List<Issue> issues,
            List<String> blockers,
            long projectedBytes) {}
    private record ObjectDigest(String sha256, long bytes) {}

    private static final class MutableSourceFile {
        private Long attachmentId;
        private final String relativePath;
        private final Set<String> referencedBy = new LinkedHashSet<>();
        private final List<String> reasons = new ArrayList<>();
        private boolean ambiguousAttachmentIds;
        private String sha256;
        private Long fileSize;

        private MutableSourceFile(Long attachmentId, String relativePath) {
            this.attachmentId = attachmentId;
            this.relativePath = relativePath;
        }
    }
}
