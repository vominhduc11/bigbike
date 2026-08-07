package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetArticle;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class LiveRedirectPlannerTest {

    private static final Set<String> LIVE = Set.of(
            "/product/public-product/",
            "/tin-tuc/public-article/",
            "/danh-muc/mu-bao-hiem/",
            "/tin-tuc/");

    @Test
    void replacesOnlyUnauditedLegacyMissingOrNonPublicTargets() {
        assertThat(LiveRedirectPlanner.safeReplacementReason(
                redirect("/product/missing-product", false),
                "/danh-muc/mu-bao-hiem/", LIVE)).contains("missing or non-public");
        assertThat(LiveRedirectPlanner.safeReplacementReason(
                redirect("/sp/old-product.html", false),
                "/danh-muc/mu-bao-hiem/", LIVE)).contains("legacy URL");
        assertThat(LiveRedirectPlanner.safeReplacementReason(
                redirect("/tin-tuc/old-article.html", false),
                "/tin-tuc/public-article/", LIVE)).contains("legacy URL");
    }

    @Test
    void refusesAdminAuditedFixedQueryAndDifferentLiveTargets() {
        assertThat(LiveRedirectPlanner.safeReplacementReason(
                redirect("/product/missing-product", true),
                "/danh-muc/mu-bao-hiem/", LIVE)).isNull();
        assertThat(LiveRedirectPlanner.safeReplacementReason(
                redirect("/product/missing-product?campaign=keep", false),
                "/danh-muc/mu-bao-hiem/", LIVE)).isNull();
        assertThat(LiveRedirectPlanner.safeReplacementReason(
                redirect("/product/public-product/", false),
                "/danh-muc/mu-bao-hiem/", LIVE)).isNull();
    }

    @Test
    void normalizesAnUnauditedRuleToItsReviewedCanonicalTarget() {
        assertThat(LiveRedirectPlanner.safeReplacementReason(
                redirect("/product/public-product", false),
                "/product/public-product/", LIVE)).contains("canonical 301 target");
    }

    @Test
    void ownerAcknowledgmentKeepsUnsafeAliasAt404WithoutCreatingARedirect() {
        WpPost product = new WpPost(
                99L, 1L, null, null, "", "Không có đích", "", "publish", "closed",
                "khong-co-dich", "product", 0L, 0, "", "", 0L);
        var source = new LiveWordPressSnapshotReader.Snapshot(
                Map.of(product.id(), product), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                List.of(), List.of(), Map.of(), List.of());
        var target = new LiveTargetSnapshotReader.Snapshot(
                "public", "370", false, true, true,
                List.of(), List.of(), List.of(), Map.of(), List.of(), List.of(),
                List.of(), List.of(), Map.of(), 0);
        var policy = new LiveMigrationOwnerOverrides.RedirectPolicy(
                true, "ACKNOWLEDGED_NO_SAFE_TARGET", false, false);

        var result = new LiveRedirectPlanner().plan(
                source, target, Map.of(), Map.of(), List.of(), policy);

        assertThat(result.plans()).filteredOn(plan -> plan.sourceId() == 99L)
                .singleElement().satisfies(plan -> {
                    assertThat(plan.action()).isEqualTo(
                            LiveMigrationPreflightReport.Action.ACKNOWLEDGED_NO_SAFE_TARGET);
                    assertThat(plan.targetPath()).isNull();
                });
        assertThat(result.summary().acknowledgedNoSafeTarget()).isEqualTo(1);
        assertThat(result.blockers()).doesNotContain("REDIRECTS_REQUIRE_MANUAL_REVIEW");
    }

    @Test
    void duplicateLegacyPathUsesLowestSourceIdRegardlessOfSnapshotMapOrder() {
        WpPost higherId = product(20L, "same-legacy-path");
        WpPost lowerId = product(10L, "same-legacy-path");
        Map<Long, WpPost> reverseIdOrder = new LinkedHashMap<>();
        reverseIdOrder.put(higherId.id(), higherId);
        reverseIdOrder.put(lowerId.id(), lowerId);
        var source = new LiveWordPressSnapshotReader.Snapshot(
                reverseIdOrder, Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                List.of(), List.of(), Map.of(), List.of());
        var target = new LiveTargetSnapshotReader.Snapshot(
                "public", "370", false, true, true,
                List.of(), List.of(), List.of(), Map.of(), List.of(), List.of(),
                List.of(), List.of(), Map.of(), 0);
        var policy = new LiveMigrationOwnerOverrides.RedirectPolicy(
                true, "ACKNOWLEDGED_NO_SAFE_TARGET", false, false);

        var result = new LiveRedirectPlanner().plan(
                source, target, Map.of(), Map.of(), List.of(), policy);

        assertThat(result.plans()).filteredOn(plan ->
                        "/sp/same-legacy-path.html".equals(plan.sourcePath()))
                .singleElement().satisfies(plan -> assertThat(plan.sourceId()).isEqualTo(10L));
    }

    @Test
    void contentOnlyLegacyPathsAreRewriteOnlyWhenSafeAndAcknowledgedWhenDead() {
        var source = new LiveWordPressSnapshotReader.Snapshot(
                Map.of(), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                List.of(), List.of(), Map.of(), List.of());
        TargetArticle targetArticle = new TargetArticle(
                "article-1", "legacy-article", "Article", "", "Body",
                null, null, null, "PUBLISHED", null, null, null,
                null, null, true, null, null, null);
        var target = new LiveTargetSnapshotReader.Snapshot(
                "public", "370", false, true, true,
                List.of(), List.of(), List.of(targetArticle), Map.of(), List.of(), List.of(),
                List.of(), List.of(), Map.of(), 0);
        var policy = new LiveMigrationOwnerOverrides.RedirectPolicy(
                true, "ACKNOWLEDGED_NO_SAFE_TARGET", false, false);

        var result = new LiveRedirectPlanner().plan(
                source, target, Map.of(), Map.of(),
                List.of("/vi/legacy-article.html", "/sp/content-only-dead.html"),
                policy);

        assertThat(result.plans()).filteredOn(plan ->
                        "/legacy-article.html".equals(plan.sourcePath()))
                .singleElement().satisfies(plan -> {
                    assertThat(plan.targetPath()).isEqualTo("/tin-tuc/legacy-article/");
                    assertThat(plan.action()).isEqualTo(
                            LiveMigrationPreflightReport.Action.REWRITE_URLS_ONLY);
                });
        assertThat(result.plans()).filteredOn(plan ->
                        "/sp/content-only-dead.html".equals(plan.sourcePath()))
                .singleElement().satisfies(plan -> {
                    assertThat(plan.targetPath()).isNull();
                    assertThat(plan.action()).isEqualTo(
                            LiveMigrationPreflightReport.Action.ACKNOWLEDGED_NO_SAFE_TARGET);
                });
        assertThat(result.plans()).filteredOn(plan ->
                        "TARGET_CONTENT_REFERENCE".equals(plan.sourceType()))
                .noneMatch(plan -> plan.action()
                        == LiveMigrationPreflightReport.Action.INSERT);
        assertThat(result.summary().contentRewriteOnly()).isEqualTo(1);
        assertThat(result.summary().acknowledgedNoSafeTarget()).isEqualTo(1);
    }

    private TargetRedirect redirect(String target, boolean adminAudited) {
        return new TargetRedirect(
                "11111111-1111-1111-1111-111111111111",
                "/old.html", target, true, adminAudited);
    }

    private WpPost product(long id, String slug) {
        return new WpPost(
                id, 1L, null, null, "", "Product " + id, "", "publish", "closed",
                slug, "product", 0L, 0, "", "", 0L);
    }
}
