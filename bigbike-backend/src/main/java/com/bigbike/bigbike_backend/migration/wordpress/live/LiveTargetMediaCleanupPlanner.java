package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.TargetMediaCleanup;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Issue;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.MediaReferenceEvidence;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetMediaChecksumPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetMediaCleanupPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetMediaCleanupSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetMediaRebindPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.Snapshot;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetMedia;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Read-only exact-reference and canonical-evidence planner for target media cleanup. */
final class LiveTargetMediaCleanupPlanner {

    private static final Set<String> EXCLUDED_TABLES = Set.of(
            "media", "audit_logs", "flyway_schema_history",
            "live_migration_runs", "live_migration_checkpoints",
            "customers", "customer_addresses", "customer_sessions",
            "customer_password_reset_tokens", "customer_email_verification_tokens",
            "admin_users", "admin_user_roles", "admin_refresh_tokens",
            "orders", "order_line_items", "order_shipping_items", "order_fee_items",
            "order_applied_coupons", "order_addresses", "order_notes");
    private static final Set<String> SCANNED_TYPES = Set.of(
            "text", "character varying", "character", "json", "jsonb", "uuid");

    Result plan(
            Connection connection,
            Snapshot target,
            List<TargetMediaChecksumPlan> checksumPlans,
            TargetMediaCleanup policy) throws SQLException {
        if (!connection.isReadOnly()) {
            throw new IllegalStateException("Target media cleanup planner requires a read-only connection");
        }

        Map<String, TargetMedia> mediaById = target.media().stream()
                .collect(Collectors.toMap(TargetMedia::id, Function.identity()));
        Map<String, TargetMediaChecksumPlan> checksumById = checksumPlans.stream()
                .collect(Collectors.toMap(TargetMediaChecksumPlan::targetMediaId, Function.identity()));
        Set<String> missingIds = checksumPlans.stream()
                .filter(this::isMissingObject)
                .map(TargetMediaChecksumPlan::targetMediaId)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        Map<String, List<TargetMediaChecksumPlan>> duplicateGroups = checksumPlans.stream()
                .filter(plan -> plan.sha256() != null)
                .collect(Collectors.groupingBy(
                        TargetMediaChecksumPlan::sha256, LinkedHashMap::new, Collectors.toList()));
        duplicateGroups.entrySet().removeIf(entry -> entry.getValue().size() < 2);

        LinkedHashSet<String> impactedIds = new LinkedHashSet<>(missingIds);
        duplicateGroups.values().forEach(group -> group.forEach(plan -> impactedIds.add(plan.targetMediaId())));
        Map<String, MediaNeedles> needlesById = new LinkedHashMap<>();
        for (String id : impactedIds) {
            TargetMedia media = mediaById.get(id);
            if (media == null) continue;
            needlesById.put(id, needles(media));
        }

        ScanResult scan = scanReferences(connection, needlesById);
        List<TargetMediaCleanupPlan> plans = new ArrayList<>();
        List<Issue> issues = new ArrayList<>(scan.issues());
        List<String> blockers = new ArrayList<>();
        int missingDelete = 0;
        int missingReferenced = 0;
        int duplicateRows = 0;
        int duplicateDelete = 0;
        int rebindFields = 0;

        for (String id : missingIds) {
            TargetMedia media = mediaById.get(id);
            TargetMediaChecksumPlan checksum = checksumById.get(id);
            if (media == null || checksum == null) continue;
            List<CellReference> references = scan.referencesByMediaId().getOrDefault(id, List.of());
            boolean unreferenced = references.isEmpty();
            String action;
            List<String> reasons = new ArrayList<>();
            if (unreferenced) {
                action = "DELETE_DB_ROW_AFTER_VERIFIED_BACKUP_FINAL_SCAN_AND_EXPLICIT_CONFIRMATION";
                reasons.add("Final read-only scan found zero UUID/URL/object-key references");
                missingDelete++;
            } else {
                action = "RETAIN_BLOCKED_REFERENCED_MISSING_OBJECT";
                reasons.add("Missing object still has exact target references; deletion is forbidden");
                missingReferenced++;
                blockers.add("TARGET_MEDIA_MISSING_OBJECT_REFERENCED");
                issues.add(new Issue(
                        "BLOCKER", "TARGET_MEDIA_CLEANUP", id,
                        "TARGET_MISSING_MEDIA_REFERENCED",
                        references.size() + " exact reference field(s) still point to the missing object"));
            }
            plans.add(cleanupPlan(
                    media, checksum, "MISSING_OBJECT", null, references, List.of(), action, reasons));
        }

        for (Map.Entry<String, List<TargetMediaChecksumPlan>> entry : duplicateGroups.entrySet()) {
            List<TargetMediaChecksumPlan> group = entry.getValue();
            Map<String, Integer> referenceCounts = new LinkedHashMap<>();
            scan.referencesByMediaId().forEach(
                    (id, references) -> referenceCounts.put(id, references.size()));
            TargetMediaChecksumPlan canonicalChecksum = selectCanonical(
                    group, mediaById, referenceCounts);
            TargetMedia canonical = mediaById.get(canonicalChecksum.targetMediaId());
            for (TargetMediaChecksumPlan checksum : group.stream()
                    .sorted(Comparator.comparing(TargetMediaChecksumPlan::targetMediaId)).toList()) {
                TargetMedia media = mediaById.get(checksum.targetMediaId());
                if (media == null) continue;
                List<CellReference> references = scan.referencesByMediaId()
                        .getOrDefault(media.id(), List.of());
                duplicateRows++;
                if (media.id().equals(canonical.id())) {
                    plans.add(cleanupPlan(
                            media, checksum, "DUPLICATE_SHA_CANONICAL", canonical.id(),
                            references, List.of(), "KEEP_CANONICAL_DB_ROW_AND_OBJECT",
                            List.of(
                                    "Canonical chosen by object validity, reference count, audit provenance, age, then ID",
                                    "Canonical selection never uses filename")));
                    continue;
                }
                List<TargetMediaRebindPlan> rebinds = buildRebinds(
                        media, canonical, references);
                boolean allReferencesRebindable = rebinds.size() == references.size();
                String action;
                List<String> reasons = new ArrayList<>();
                if (allReferencesRebindable) {
                    action = "REBIND_THEN_DELETE_DB_ROW_AFTER_VERIFIED_BACKUP_FINAL_SCAN_AND_EXPLICIT_CONFIRMATION";
                    reasons.add("Every exact reference has a whole-field hash-bound canonical replacement");
                    reasons.add("Do not delete the duplicate MinIO object before cutover; retain at least "
                            + policy.duplicateObjectRetentionHours() + " hours after stable cutover");
                    duplicateDelete++;
                    rebindFields += rebinds.size();
                } else {
                    action = "BLOCKED_UNSAFE_REBIND";
                    reasons.add("At least one reference cannot be deterministically rebound to the canonical row");
                    blockers.add("TARGET_MEDIA_DUPLICATE_REBIND_INCOMPLETE");
                    issues.add(new Issue(
                            "BLOCKER", "TARGET_MEDIA_CLEANUP", media.id(),
                            "TARGET_MEDIA_DUPLICATE_REBIND_INCOMPLETE",
                            "Only " + rebinds.size() + " of " + references.size()
                                    + " reference field(s) have deterministic replacements"));
                }
                plans.add(cleanupPlan(
                        media, checksum, "DUPLICATE_SHA_NONCANONICAL", canonical.id(),
                        references, rebinds, action, reasons));
            }
        }

        if (!missingIds.isEmpty() || !duplicateGroups.isEmpty()) {
            blockers.add("TARGET_MEDIA_CLEANUP_REQUIRES_SEPARATE_CONFIRMATION");
        }
        blockers.addAll(scan.blockers());
        int databaseDeletionCandidates = missingDelete + duplicateDelete;
        TargetMediaCleanupSummary summary = new TargetMediaCleanupSummary(
                missingIds.size(), missingDelete, missingReferenced, duplicateGroups.size(),
                duplicateRows, duplicateDelete, rebindFields, databaseDeletionCandidates);
        plans.sort(Comparator.comparing(TargetMediaCleanupPlan::integrityState)
                .thenComparing(TargetMediaCleanupPlan::targetMediaId));
        return new Result(
                List.copyOf(plans), summary, List.copyOf(issues),
                List.copyOf(new LinkedHashSet<>(blockers)));
    }

    TargetMediaChecksumPlan selectCanonical(
            List<TargetMediaChecksumPlan> group,
            Map<String, TargetMedia> mediaById,
            Map<String, Integer> referenceCounts) {
        return group.stream().min(canonicalComparator(mediaById, referenceCounts)).orElseThrow();
    }

    private Comparator<TargetMediaChecksumPlan> canonicalComparator(
            Map<String, TargetMedia> mediaById,
            Map<String, Integer> referenceCounts) {
        return Comparator
                .comparing((TargetMediaChecksumPlan plan) ->
                        !objectIntegrityValid(plan))
                .thenComparing((TargetMediaChecksumPlan plan) ->
                        -referenceCounts.getOrDefault(plan.targetMediaId(), 0))
                .thenComparing((TargetMediaChecksumPlan plan) ->
                        -mediaById.get(plan.targetMediaId()).adminAuditCount())
                .thenComparing((TargetMediaChecksumPlan plan) ->
                        -mediaById.get(plan.targetMediaId()).auditCount())
                .thenComparing(plan -> nullableInstant(mediaById.get(plan.targetMediaId()).createdAt()))
                .thenComparing(TargetMediaChecksumPlan::targetMediaId);
    }

    private Instant nullableInstant(Instant value) {
        return value == null ? Instant.MAX : value;
    }

    private TargetMediaCleanupPlan cleanupPlan(
            TargetMedia media,
            TargetMediaChecksumPlan checksum,
            String state,
            String canonicalId,
            List<CellReference> references,
            List<TargetMediaRebindPlan> rebinds,
            String action,
            List<String> reasons) {
        List<MediaReferenceEvidence> evidence = references.stream()
                .map(reference -> new MediaReferenceEvidence(
                        reference.table(), reference.column(), reference.rowKey(),
                        String.join(",", reference.matchedBy())))
                .toList();
        return new TargetMediaCleanupPlan(
                media.id(), checksum.sha256(), checksum.bucket(), checksum.objectKey(),
                media.publicUrl(), state, canonicalId, references.size(),
                media.auditCount(), media.adminAuditCount(), media.createdAt(), action,
                evidence, rebinds, List.copyOf(reasons));
    }

    private List<TargetMediaRebindPlan> buildRebinds(
            TargetMedia duplicate,
            TargetMedia canonical,
            List<CellReference> references) {
        MediaNeedles from = needles(duplicate);
        MediaNeedles to = needles(canonical);
        List<TargetMediaRebindPlan> result = new ArrayList<>();
        for (CellReference reference : references) {
            String after = reference.value();
            List<String> replacements = new ArrayList<>();
            if (reference.matchedBy().contains("MEDIA_ID")) {
                after = after.replace(from.mediaId(), to.mediaId());
                replacements.add("MEDIA_ID:" + from.mediaId() + "->" + to.mediaId());
            }
            if (reference.matchedBy().contains("PUBLIC_URL")) {
                if (from.publicUrl() == null || to.publicUrl() == null) continue;
                after = after.replace(from.publicUrl(), to.publicUrl());
                replacements.add("PUBLIC_URL:" + from.publicUrl() + "->" + to.publicUrl());
            }
            if (reference.matchedBy().contains("OBJECT_KEY")) {
                if (from.objectKey() == null || to.objectKey() == null) continue;
                after = after.replace(from.objectKey(), to.objectKey());
                replacements.add("OBJECT_KEY:" + from.objectKey() + "->" + to.objectKey());
            }
            if (replacements.isEmpty() || after.equals(reference.value())) continue;
            result.add(new TargetMediaRebindPlan(
                    reference.table(), reference.column(), reference.rowKey(),
                    sha256(reference.value()), sha256(after), List.copyOf(replacements),
                    "PRIMARY_KEY_EQUALS_AND_WHOLE_FIELD_SHA256_EQUALS"));
        }
        return List.copyOf(result);
    }

    private ScanResult scanReferences(
            Connection connection, Map<String, MediaNeedles> needlesById) throws SQLException {
        if (needlesById.isEmpty()) return new ScanResult(Map.of(), List.of(), List.of());
        Map<String, List<String>> primaryKeys = primaryKeys(connection);
        List<ScanColumn> columns = scanColumns(connection, primaryKeys);
        Map<String, List<CellReference>> matches = new LinkedHashMap<>();
        List<Issue> issues = new ArrayList<>();
        List<String> blockers = new ArrayList<>();

        for (ScanColumn column : columns) {
            String keyExpression = column.primaryKeys().isEmpty()
                    ? "'<NO_PRIMARY_KEY>'"
                    : "concat_ws('|'," + column.primaryKeys().stream()
                            .map(key -> quote(key) + "::text")
                            .collect(Collectors.joining(",")) + ")";
            String sql = "select " + keyExpression + " as row_key, "
                    + quote(column.column()) + "::text as field_value from "
                    + quote(column.table()) + " where " + quote(column.column()) + " is not null";
            try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
                while (rs.next()) {
                    String rowKey = rs.getString("row_key");
                    String value = rs.getString("field_value");
                    if (value == null || value.isBlank()) continue;
                    for (Map.Entry<String, MediaNeedles> entry : needlesById.entrySet()) {
                        Set<String> matchedBy = matchedBy(value, column.dataType(), entry.getValue());
                        if (matchedBy.isEmpty()) continue;
                        matches.computeIfAbsent(entry.getKey(), ignored -> new ArrayList<>())
                                .add(new CellReference(
                                        column.table(), column.column(), rowKey,
                                        value, List.copyOf(matchedBy)));
                        if (column.primaryKeys().isEmpty()) {
                            blockers.add("TARGET_MEDIA_REFERENCE_WITHOUT_PRIMARY_KEY");
                            issues.add(new Issue(
                                    "BLOCKER", "TARGET_MEDIA_CLEANUP", entry.getKey(),
                                    "TARGET_MEDIA_REFERENCE_WITHOUT_PRIMARY_KEY",
                                    column.table() + "." + column.column()
                                            + " contains a reference but has no primary key"));
                        }
                    }
                }
            }
        }
        Map<String, List<CellReference>> immutable = new LinkedHashMap<>();
        matches.forEach((id, values) -> immutable.put(id, List.copyOf(values)));
        return new ScanResult(
                Map.copyOf(immutable), List.copyOf(issues),
                List.copyOf(new LinkedHashSet<>(blockers)));
    }

    private Set<String> matchedBy(String value, String type, MediaNeedles needles) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if ("uuid".equals(type)) {
            if (value.equalsIgnoreCase(needles.mediaId())) result.add("MEDIA_ID");
            return result;
        }
        if (value.contains(needles.mediaId())) result.add("MEDIA_ID");
        if (needles.publicUrl() != null && value.contains(needles.publicUrl())) result.add("PUBLIC_URL");
        if (needles.objectKey() != null && value.contains(needles.objectKey())) result.add("OBJECT_KEY");
        return result;
    }

    private Map<String, List<String>> primaryKeys(Connection connection) throws SQLException {
        String sql = """
                select kcu.table_name, kcu.column_name
                from information_schema.table_constraints tc
                join information_schema.key_column_usage kcu
                  on tc.constraint_name=kcu.constraint_name
                 and tc.table_schema=kcu.table_schema
                where tc.table_schema=current_schema() and tc.constraint_type='PRIMARY KEY'
                order by kcu.table_name, kcu.ordinal_position
                """;
        Map<String, List<String>> result = new LinkedHashMap<>();
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                result.computeIfAbsent(rs.getString(1), ignored -> new ArrayList<>()).add(rs.getString(2));
            }
        }
        Map<String, List<String>> immutable = new LinkedHashMap<>();
        result.forEach((table, keys) -> immutable.put(table, List.copyOf(keys)));
        return Map.copyOf(immutable);
    }

    private List<ScanColumn> scanColumns(
            Connection connection, Map<String, List<String>> primaryKeys) throws SQLException {
        String sql = """
                select table_name, column_name, data_type
                from information_schema.columns
                where table_schema=current_schema()
                order by table_name, ordinal_position
                """;
        List<ScanColumn> result = new ArrayList<>();
        try (Statement statement = connection.createStatement(); ResultSet rs = statement.executeQuery(sql)) {
            while (rs.next()) {
                String table = rs.getString(1);
                String column = rs.getString(2);
                String type = rs.getString(3).toLowerCase(Locale.ROOT);
                if (EXCLUDED_TABLES.contains(table) || !SCANNED_TYPES.contains(type)) continue;
                result.add(new ScanColumn(
                        table, column, type, primaryKeys.getOrDefault(table, List.of())));
            }
        }
        return List.copyOf(result);
    }

    private MediaNeedles needles(TargetMedia media) {
        String objectKey = LiveMediaPlanner.targetObjectKey(media);
        String publicUrl = trimToNull(media.publicUrl());
        if (publicUrl == null && objectKey != null) publicUrl = "/media/" + objectKey;
        return new MediaNeedles(media.id(), publicUrl, objectKey);
    }

    private boolean isMissingObject(TargetMediaChecksumPlan plan) {
        if (plan.action() != Action.CONFLICT) return false;
        return plan.reasons().stream().anyMatch(reason -> {
            String lower = reason.toLowerCase(Locale.ROOT);
            return lower.contains("could not be read") || lower.contains("no resolvable bucket/object key");
        });
    }

    private boolean objectIntegrityValid(TargetMediaChecksumPlan plan) {
        if (plan.sha256() == null || plan.objectBytes() == null) return false;
        return plan.reasons().stream().noneMatch(reason -> {
            String lower = reason.toLowerCase(Locale.ROOT);
            return lower.contains("could not be read")
                    || lower.contains("no resolvable bucket/object key")
                    || lower.contains("differs from current object bytes")
                    || lower.contains("hashing is disabled");
        });
    }

    private String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    record Result(
            List<TargetMediaCleanupPlan> plans,
            TargetMediaCleanupSummary summary,
            List<Issue> issues,
            List<String> blockers) {}

    private record MediaNeedles(String mediaId, String publicUrl, String objectKey) {}
    private record ScanColumn(
            String table, String column, String dataType, List<String> primaryKeys) {}
    private record CellReference(
            String table,
            String column,
            String rowKey,
            String value,
            List<String> matchedBy) {}
    private record ScanResult(
            Map<String, List<CellReference>> referencesByMediaId,
            List<Issue> issues,
            List<String> blockers) {}
}
