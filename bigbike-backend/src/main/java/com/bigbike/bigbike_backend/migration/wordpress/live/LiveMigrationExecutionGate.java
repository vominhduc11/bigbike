package com.bigbike.bigbike_backend.migration.wordpress.live;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import tools.jackson.databind.ObjectMapper;

/** Fail-closed binding between the operator-reviewed plan and a fresh read-only plan. */
final class LiveMigrationExecutionGate {

    ValidatedPlan validate(
            LiveMigrationExecutionOptions options,
            LiveMigrationPreflightReport freshPlan) throws Exception {
        List<String> errors = new ArrayList<>();
        if (!Files.isRegularFile(options.reviewedPlanPath())
                || !Files.isReadable(options.reviewedPlanPath())) {
            throw new IllegalStateException("Execution blocked: reviewed plan is missing or unreadable");
        }

        LiveMigrationPlanDigest digester = new LiveMigrationPlanDigest();
        String reviewedFileSha = digester.fileSha256(options.reviewedPlanPath());
        if (!isSha256(options.expectedReviewedPlanSha256())
                || !reviewedFileSha.equals(options.expectedReviewedPlanSha256())) {
            errors.add("Reviewed plan file SHA-256 does not match operator expectation");
        }

        LiveMigrationPreflightReport reviewed;
        try {
            reviewed = new ObjectMapper().readValue(
                    Files.readAllBytes(options.reviewedPlanPath()), LiveMigrationPreflightReport.class);
        } catch (Exception e) {
            throw new IllegalStateException("Execution blocked: reviewed plan JSON cannot be parsed", e);
        }

        validatePlanState("reviewed", reviewed, errors);
        validatePlanState("fresh", freshPlan, errors);
        if (!reviewed.metadata().snapshotId().equals(freshPlan.metadata().snapshotId())) {
            errors.add("Fresh snapshot id differs from reviewed plan");
        }
        if (!reviewed.metadata().sourceDumpSha256().equals(freshPlan.metadata().sourceDumpSha256())) {
            errors.add("Fresh source dump SHA-256 differs from reviewed plan");
        }
        if (!reviewed.targetCounts().protectedDomains()
                .equals(freshPlan.targetCounts().protectedDomains())) {
            errors.add("Protected customer/order/admin baseline changed after review");
        }

        String reviewedDigest = digester.digest(reviewed);
        String freshDigest = digester.digest(freshPlan);
        if (!reviewedDigest.equals(freshDigest)) {
            errors.add("Fresh immutable plan digest differs from reviewed plan");
        }
        String expectedConfirmation = expectedConfirmation(
                reviewed.metadata().snapshotId(), reviewed.metadata().sourceDumpSha256(), reviewedFileSha);
        if (!expectedConfirmation.equals(options.executionConfirmation())) {
            errors.add("Exact snapshot/hash-bound execution confirmation is missing");
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException("Execution blocked:\n- " + String.join("\n- ", errors));
        }
        return new ValidatedPlan(reviewed, reviewedFileSha, reviewedDigest);
    }

    static String expectedConfirmation(String snapshotId, String dumpSha256, String planSha256) {
        return "EXECUTE_BIGBIKE_LIVE_MIGRATION:"
                + snapshotId + ":" + dumpSha256.substring(0, 16) + ":" + planSha256.substring(0, 16);
    }

    private void validatePlanState(
            String label, LiveMigrationPreflightReport report, List<String> errors) {
        if (!report.metadata().finalSnapshot()) errors.add(label + " plan is not a final snapshot");
        if (!report.metadata().freezeConfirmed()) errors.add(label + " plan has no freeze confirmation");
        if (!report.metadata().targetTransactionReadOnly()) {
            errors.add(label + " preflight did not use a read-only target transaction");
        }
        if (!report.safety().offsiteBackupManifestValid()) {
            errors.add(label + " plan has no valid off-VPS backup manifest");
        }
        if (!report.safety().mediaChecksumSchemaPresent()) {
            errors.add(label + " target has no media SHA-256 schema");
        }
        if (report.safety().contentCategoryCleanupPending()) {
            errors.add(label + " target still contains content-category schema");
        }
        if (migrationVersion(report.metadata().targetMigrationVersion()) < 370) {
            errors.add(label + " target schema is older than V370");
        }
        if (!report.blockers().isEmpty()) {
            errors.add(label + " plan still has blockers: " + report.blockers());
        }
        if (report.ownerDecisions() == null
                || report.ownerDecisions().overrides() == null
                || !isSha256(report.ownerDecisions().overrides().sha256())) {
            errors.add(label + " plan has no hash-bound owner override");
        } else {
            var duplicate = report.ownerDecisions().duplicateProductSelection();
            // Owner decision 2026-08-05: the Vietnamese row 41038 is canonical and the English
            // row 41181 is the alias whose wording is merged into the *_en columns.
            if (duplicate == null || !duplicate.expectedSelectionMatched()
                    || !Long.valueOf(41038L).equals(duplicate.selectedSourceId())
                    || !Long.valueOf(41181L).equals(duplicate.excludedSourceId())) {
                errors.add(label + " plan does not contain the exact reviewed SCS-S10X selection");
            }
            if (report.ownerDecisions().overrides().version() >= 2
                    && (report.ownerDecisions().exactTargetFieldMutations() == null
                        || report.ownerDecisions().exactTargetFieldMutations().size() != 2
                        || report.ownerDecisions().exactTargetFieldMutations().stream().anyMatch(
                                plan -> !LiveOwnerExactTargetFieldMutationPlanner.ALREADY_APPLIED
                                        .equals(plan.status())))) {
                errors.add(label + " plan has unapplied or invalid exact target-field mutations");
            }
        }
        if (report.issues().stream().anyMatch(issue -> SetSeverity.BLOCKING.contains(
                issue.severity().toUpperCase(Locale.ROOT)))) {
            errors.add(label + " plan still contains blocker/conflict issues");
        }
        if (report.products().stream().anyMatch(plan -> plan.action() == Action.CONFLICT
                        || plan.action() == Action.MANUAL_REVIEW)
                || report.variants().stream().anyMatch(plan -> plan.action() == Action.CONFLICT)
                || report.articles().stream().anyMatch(plan -> plan.action() == Action.CONFLICT)
                || report.media().stream().anyMatch(plan -> plan.action() == Action.CONFLICT)
                || report.targetMediaChecksums().stream()
                        .anyMatch(plan -> plan.action() == Action.CONFLICT)
                || report.targetContentRewrites().stream()
                        .anyMatch(plan -> plan.action() == Action.CONFLICT)
                || report.redirects().stream().anyMatch(plan -> plan.action() == Action.CONFLICT)) {
            errors.add(label + " plan contains unresolved write conflicts");
        }
        if (report.products().stream().anyMatch(plan -> plan.action() == Action.SKIP
                && !plan.missingRequiredFields().isEmpty())) {
            errors.add(label + " plan still skips products with unresolved required fields");
        }
        if (report.redirects().stream().anyMatch(plan ->
                plan.action() == Action.ACKNOWLEDGED_NO_SAFE_TARGET
                        && plan.targetPath() != null)) {
            errors.add(label + " acknowledged no-safe-target redirect unexpectedly has a write target");
        }
    }

    private int migrationVersion(String value) {
        if (value == null) return -1;
        try {
            return Integer.parseInt(value.replaceFirst("^([0-9]+).*$", "$1"));
        } catch (RuntimeException e) {
            return -1;
        }
    }

    private boolean isSha256(String value) {
        return value != null && value.matches("[0-9a-f]{64}");
    }

    record ValidatedPlan(
            LiveMigrationPreflightReport report,
            String reviewedPlanSha256,
            String planDigestSha256) {}

    private static final class SetSeverity {
        private static final java.util.Set<String> BLOCKING = java.util.Set.of("BLOCKER", "CONFLICT");
    }
}
