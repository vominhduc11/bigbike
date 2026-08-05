package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.ExactTargetFieldMutation;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.TargetContentPolicy;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.Snapshot;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetArticle;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LiveOwnerExactTargetFieldMutationPlannerTest {

    private static final String BEFORE = "[{\"type\":\"text\",\"text\":\"keep, [nested]\"}, "
            + "{\"type\":\"image\",\"url\":\"/missing-a.jpg\",\"alt\":\"A\",\"caption\":\"\"}, "
            + "{\"type\":\"feature\",\"items\":[{\"url\":\"/keep.jpg\"}]}, "
            + "{\"type\":\"image\",\"url\":\"/missing-b.jpg\",\"alt\":\"B\",\"caption\":\"\"}]";
    private static final String AFTER = "[{\"type\":\"text\",\"text\":\"keep, [nested]\"}, "
            + "{\"type\":\"feature\",\"items\":[{\"url\":\"/keep.jpg\"}]}]";

    @Test
    void provesExactRawPreservingBodyMutationButKeepsItBlockedForSeparateExecution() {
        var planner = new LiveOwnerExactTargetFieldMutationPlanner();
        ExactTargetFieldMutation mutation = bodyMutation();

        var result = planner.plan(snapshot(BEFORE, null), policy(mutation));

        assertThat(planner.removeExactTopLevelImageNodes(
                BEFORE, List.of("/missing-a.jpg", "/missing-b.jpg"))).isEqualTo(AFTER);
        assertThat(result.plans()).singleElement().satisfies(plan -> {
            assertThat(plan.status()).isEqualTo(LiveOwnerExactTargetFieldMutationPlanner.PENDING);
            assertThat(plan.observedSha256()).isEqualTo(sha256(BEFORE));
            assertThat(plan.plannedAfterSha256()).isEqualTo(sha256(AFTER));
            assertThat(plan.operations()).containsExactly(
                    "REMOVE_EXACT_TOP_LEVEL_IMAGE_NODE:/missing-a.jpg",
                    "REMOVE_EXACT_TOP_LEVEL_IMAGE_NODE:/missing-b.jpg");
        });
        assertThat(result.blockers()).containsExactly(
                "OWNER_EXACT_TARGET_FIELD_MUTATIONS_REQUIRE_SEPARATE_EXECUTOR_CONFIRMATION");
        assertThat(result.issues()).singleElement().satisfies(issue ->
                assertThat(issue.code()).isEqualTo(
                        "OWNER_EXACT_TARGET_FIELD_MUTATION_PENDING"));
    }

    @Test
    void failsClosedOnWholeFieldDriftBeforeParsingNodes() {
        var planner = new LiveOwnerExactTargetFieldMutationPlanner();

        var result = planner.plan(snapshot(BEFORE + " ", null), policy(bodyMutation()));

        assertThat(result.plans()).singleElement().satisfies(plan -> {
            assertThat(plan.status()).isEqualTo(LiveOwnerExactTargetFieldMutationPlanner.CONFLICT);
            assertThat(plan.reasons()).singleElement().asString()
                    .contains("does not match the approved before- or after-state");
        });
        assertThat(result.blockers()).containsExactly(
                "OWNER_EXACT_TARGET_FIELD_MUTATION_CONFLICTS");
    }

    @Test
    void recognizesTheExactBodyAfterStateIdempotently() {
        var result = new LiveOwnerExactTargetFieldMutationPlanner()
                .plan(snapshot(AFTER, null), policy(bodyMutation()));

        assertThat(result.plans()).singleElement().satisfies(plan -> {
            assertThat(plan.status()).isEqualTo(
                    LiveOwnerExactTargetFieldMutationPlanner.ALREADY_APPLIED);
            assertThat(plan.observedSha256()).isEqualTo(sha256(AFTER));
        });
        assertThat(result.issues()).isEmpty();
        assertThat(result.blockers()).isEmpty();
    }

    @Test
    void plansOnlyTheExactCoverUrlAndRecognizesNullAsApplied() {
        String cover = "https://media.bigbike.vn/missing-cover.jpg";
        ExactTargetFieldMutation mutation = new ExactTargetFieldMutation(
                "ARTICLE", "wp-art-41091", "cover_image_url", "SET_NULL_IF_EXACT_VALUE",
                List.of("media-cover"), List.of(cover), sha256(cover), null, true,
                "Owner confirmed exact null");
        var planner = new LiveOwnerExactTargetFieldMutationPlanner();

        var pending = planner.plan(snapshot(BEFORE, cover), policy(mutation));
        var applied = planner.plan(snapshot(BEFORE, null), policy(mutation));

        assertThat(pending.plans()).singleElement().satisfies(plan -> {
            assertThat(plan.status()).isEqualTo(LiveOwnerExactTargetFieldMutationPlanner.PENDING);
            assertThat(plan.plannedNull()).isTrue();
            assertThat(plan.operations()).containsExactly("SET_NULL_IF_EXACT_VALUE:" + cover);
        });
        assertThat(applied.plans()).singleElement().satisfies(plan ->
                assertThat(plan.status()).isEqualTo(
                        LiveOwnerExactTargetFieldMutationPlanner.ALREADY_APPLIED));
        assertThat(applied.blockers()).isEmpty();
    }

    private ExactTargetFieldMutation bodyMutation() {
        return new ExactTargetFieldMutation(
                "ARTICLE", "wp-art-41091", "body_blocks", "REMOVE_EXACT_JSON_IMAGE_NODES",
                List.of("media-a", "media-b"),
                List.of("/missing-a.jpg", "/missing-b.jpg"),
                sha256(BEFORE), sha256(AFTER), false, "Owner confirmed exact removal");
    }

    private TargetContentPolicy policy(ExactTargetFieldMutation mutation) {
        return new TargetContentPolicy(
                true, true, false, false, false, List.of(mutation));
    }

    private Snapshot snapshot(String bodyBlocks, String coverImageUrl) {
        TargetArticle article = new TargetArticle(
                "wp-art-41091", "article", "Title", null, null,
                null, coverImageUrl, null, "DRAFT", null, null, null,
                null, null, false, null, null, bodyBlocks);
        return new Snapshot(
                "public", "367", true, false, false,
                List.of(), List.of(), List.of(article), Map.of(), List.of(), List.of(),
                List.of(), List.of(), Map.of(), 0);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
