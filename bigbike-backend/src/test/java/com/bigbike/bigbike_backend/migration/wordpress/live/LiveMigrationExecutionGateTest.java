package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.ActionCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.MediaSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Metadata;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Safety;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.SeoSummary;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.SourceCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetCounts;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetContentRewriteSummary;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LiveMigrationExecutionGateTest {

    @TempDir
    Path tempDir;

    @Test
    void acceptsOnlyExactReviewedFileFreshDigestAndBoundConfirmation() throws Exception {
        LiveMigrationPreflightReport reviewed = report(Instant.parse("2026-08-03T02:00:00Z"), List.of());
        LiveMigrationReportWriter.Paths paths = new LiveMigrationReportWriter().write(reviewed, tempDir);
        String confirmation = LiveMigrationExecutionGate.expectedConfirmation(
                reviewed.metadata().snapshotId(), reviewed.metadata().sourceDumpSha256(),
                paths.jsonSha256());
        LiveMigrationExecutionOptions options = new LiveMigrationExecutionOptions(
                paths.json(), paths.jsonSha256(), confirmation, 50);
        LiveMigrationPreflightReport fresh = report(Instant.parse("2026-08-03T02:05:00Z"), List.of());

        var result = new LiveMigrationExecutionGate().validate(options, fresh);

        assertThat(result.reviewedPlanSha256()).isEqualTo(paths.jsonSha256());
        assertThat(result.planDigestSha256()).isEqualTo(paths.planDigestSha256());
    }

    @Test
    void rejectsAnyRemainingPreflightBlockerBeforeAWriteConnectionCanOpen() throws Exception {
        LiveMigrationPreflightReport reviewed = report(
                Instant.parse("2026-08-03T02:00:00Z"), List.of("OFFSITE_BACKUP_NOT_CONFIRMED"));
        LiveMigrationReportWriter.Paths paths = new LiveMigrationReportWriter().write(reviewed, tempDir);
        String confirmation = LiveMigrationExecutionGate.expectedConfirmation(
                reviewed.metadata().snapshotId(), reviewed.metadata().sourceDumpSha256(),
                paths.jsonSha256());
        LiveMigrationExecutionOptions options = new LiveMigrationExecutionOptions(
                paths.json(), paths.jsonSha256(), confirmation, 50);

        assertThatThrownBy(() -> new LiveMigrationExecutionGate().validate(options, reviewed))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("still has blockers");
    }

    @Test
    void rejectsOwnerOverrideV2UntilExactTargetFieldMutationsAreAlreadyApplied() throws Exception {
        var pending = new LiveMigrationPreflightReport.ExactTargetFieldMutationPlan(
                "ARTICLE", "wp-art-41091", "body_blocks", "REMOVE_EXACT_JSON_IMAGE_NODES",
                List.of("media-a"), List.of("/missing.jpg"),
                "c".repeat(64), "c".repeat(64), "d".repeat(64), "d".repeat(64),
                false, LiveOwnerExactTargetFieldMutationPlanner.PENDING,
                List.of("REMOVE_EXACT_TOP_LEVEL_IMAGE_NODE:/missing.jpg"), List.of());
        var pendingCover = new LiveMigrationPreflightReport.ExactTargetFieldMutationPlan(
                "ARTICLE", "wp-art-41091", "cover_image_url", "SET_NULL_IF_EXACT_VALUE",
                List.of("media-b"), List.of("/missing-cover.jpg"),
                "e".repeat(64), "e".repeat(64), null, null,
                true, LiveOwnerExactTargetFieldMutationPlanner.PENDING,
                List.of("SET_NULL_IF_EXACT_VALUE:/missing-cover.jpg"), List.of());
        LiveMigrationPreflightReport reviewed = report(
                Instant.parse("2026-08-03T02:00:00Z"), List.of(), 2,
                List.of(pending, pendingCover));
        LiveMigrationReportWriter.Paths paths = new LiveMigrationReportWriter().write(reviewed, tempDir);
        String confirmation = LiveMigrationExecutionGate.expectedConfirmation(
                reviewed.metadata().snapshotId(), reviewed.metadata().sourceDumpSha256(),
                paths.jsonSha256());
        LiveMigrationExecutionOptions options = new LiveMigrationExecutionOptions(
                paths.json(), paths.jsonSha256(), confirmation, 50);

        assertThatThrownBy(() -> new LiveMigrationExecutionGate().validate(options, reviewed))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("unapplied or invalid exact target-field mutations");
    }

    private LiveMigrationPreflightReport report(Instant generatedAt, List<String> blockers) {
        return report(generatedAt, blockers, 1, List.of());
    }

    private LiveMigrationPreflightReport report(
            Instant generatedAt,
            List<String> blockers,
            int ownerOverrideVersion,
            List<LiveMigrationPreflightReport.ExactTargetFieldMutationPlan> exactMutations) {
        String sha = "a".repeat(64);
        Metadata metadata = new Metadata(
                "final-20260803T020000Z", "/snapshot.sql.gz", sha, 123,
                "/uploads", "kd_", true, true, true, "public", "370");
        Safety safety = new Safety(
                true, true, true, true, List.of(), false, true, true, true,
                10_000_000_000L, 1_000L);
        SourceCounts source = new SourceCounts(
                0, 0, Map.of("publish", 0), 0, Map.of(), 0, Map.of(),
                0, 0, 0, 0, 0, 0);
        TargetCounts target = new TargetCounts(
                1, 1, 1, 1, 1, 1, 1, 1,
                Map.of("customers", 2L, "orders", 3L, "admin_users", 1L));
        ActionCounts actions = new ActionCounts(0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        var owner = new LiveMigrationPreflightReport.OwnerDecisionPlans(
                new LiveMigrationPreflightReport.OwnerOverridesMetadata(
                        ownerOverrideVersion, "2026-08-03", "/owner-overrides.json", "b".repeat(64)),
                new LiveMigrationPreflightReport.DuplicateProductSelectionPlan(
                        "SCS-S10X", List.of(41038L, 41181L), 41181L, 41038L,
                        Map.of(
                                41038L, LocalDateTime.parse("2026-08-01T01:00:00"),
                                41181L, LocalDateTime.parse("2026-08-02T01:00:00")),
                        "LATEST_POST_MODIFIED_GMT", "DRAFT",
                        "RELATED_CATEGORY_OR_ACKNOWLEDGED_NO_SAFE_TARGET", true, List.of()),
                new LiveMigrationPreflightReport.ProductInferenceSummary(0, 0, 0, 0, 0, 0),
                List.of(),
                new LiveMigrationPreflightReport.SourceMediaRecoverySummary(0, 0, 0, 0, 0),
                List.of(), List.of(), exactMutations,
                new LiveMigrationPreflightReport.TargetMediaCleanupSummary(0, 0, 0, 0, 0, 0, 0, 0),
                List.of());
        return new LiveMigrationPreflightReport(
                generatedAt, metadata, safety, owner, source, target, actions, actions, actions,
                new MediaSummary(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                new RedirectSummary(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
                new SeoSummary(0, 0, 0, 0, 0, 0, 0, 0),
                new TargetContentRewriteSummary(0, 0, 0, 0, 0, 0, 0, 0),
                List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), List.of(), blockers);
    }
}
