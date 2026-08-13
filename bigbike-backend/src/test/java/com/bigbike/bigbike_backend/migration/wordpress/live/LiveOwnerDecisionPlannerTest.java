package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.DuplicateProductSelection;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.ProductInference;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.TargetMediaChecksumPlan;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetBrand;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetMedia;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveTargetSnapshotReader.TargetVariant;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LiveOwnerDecisionPlannerTest {

    @Test
    void loadsTheVersionedSecretFreeOwnerOverride() throws Exception {
        Path path = Path.of(System.getProperty("user.dir"))
                .resolve("../deploy/migration/live-migration-owner-overrides-v1.json")
                .normalize();

        var loaded = new LiveMigrationOwnerOverrides().load(path);

        assertThat(loaded.config().version()).isEqualTo(1);
        assertThat(loaded.config().duplicateProductSelection().sourceIds())
                .containsExactly(41038L, 41181L);
        assertThat(loaded.sha256()).matches("[0-9a-f]{64}");
    }

    @Test
    void loadsOwnerOverrideV2WithOnlyTheFiveConfirmedDecisions() throws Exception {
        Path path = Path.of(System.getProperty("user.dir"))
                .resolve("../deploy/migration/live-migration-owner-overrides-v2.json")
                .normalize();

        var loaded = new LiveMigrationOwnerOverrides().load(path);

        assertThat(loaded.config().version()).isEqualTo(2);
        assertThat(loaded.config().duplicateProductSelection().expectedSelectedSourceId())
                .isEqualTo(41181L);
        assertThat(loaded.config().productInference().manualFieldOverrides())
                .extracting(value -> value.sourceId())
                .containsExactlyInAnyOrder(35222L, 38995L, 39004L);
        assertThat(loaded.config().productInference().manualFieldOverrides())
                .allSatisfy(value -> {
                    assertThat(value.field()).isEqualTo("gender");
                    assertThat(value.value()).isNull();
                    assertThat(value.confidence()).isEqualTo("OWNER_CONFIRMED");
                });
        assertThat(loaded.config().sourceMediaRecovery().variantAttachmentOverrides())
                .extracting(value -> value.sourceVariantId())
                .containsExactly(30187L, 30188L);
        assertThat(loaded.config().targetContent().exactFieldMutations())
                .extracting(value -> value.field())
                .containsExactly("body_blocks", "cover_image_url");
        assertThat(loaded.sha256()).matches("[0-9a-f]{64}");
    }

    @Test
    void appliesOwnerConfirmedNullWithoutGuessingOtherManualRows() throws Exception {
        Path path = Path.of(System.getProperty("user.dir"))
                .resolve("../deploy/migration/live-migration-owner-overrides-v2.json")
                .normalize();
        ProductInference policy = new LiveMigrationOwnerOverrides().load(path)
                .config().productInference();
        WpPost post = post(35222L, "Áo bảo hộ NAM/NỮ");
        var source = new LiveWordPressSnapshotReader.Snapshot(
                Map.of(post.id(), post), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                List.of(), List.of(), Map.of(), List.of());
        var planner = new LiveProductInferencePlanner(
                policy, source, target(List.of(), List.of()), List.of(post));

        var result = planner.infer(
                post, "KNOWN-SKU", List.of(), List.of("ls2"), null, List.of(), List.of());

        assertThat(result.gender()).isNull();
        assertThat(result.manualFields()).doesNotContain("gender");
        assertThat(result.plans()).filteredOn(plan -> "gender".equals(plan.field()))
                .singleElement().satisfies(plan -> {
                    assertThat(plan.ruleId()).isEqualTo("OWNER_MANUAL_GENDER_V2");
                    assertThat(plan.confidence()).isEqualTo("OWNER_CONFIRMED");
                    assertThat(plan.decision()).isEqualTo("APPLIED");
                });
    }

    @Test
    void selectsOnlyTheExpectedLatestScsPostWithoutMerging() {
        var source = duplicateSource(
                LocalDateTime.parse("2026-08-01T01:00:00"),
                LocalDateTime.parse("2026-08-02T01:00:00"));

        var result = new LiveDuplicateProductSelectionPlanner().plan(source, duplicatePolicy());

        assertThat(result.blockers()).isEmpty();
        assertThat(result.selectedSourceId()).isEqualTo(41181L);
        assertThat(result.excludedSourceId()).isEqualTo(41038L);
        assertThat(result.plan().expectedSelectionMatched()).isTrue();
        assertThat(result.plan().reasons()).anyMatch(reason -> reason.contains("No fields"));
    }

    @Test
    void failsClosedWhenScsTimestampsAreTied() {
        LocalDateTime tied = LocalDateTime.parse("2026-08-02T01:00:00");

        var result = new LiveDuplicateProductSelectionPlanner().plan(
                duplicateSource(tied, tied), duplicatePolicy());

        assertThat(result.selectedSourceId()).isNull();
        assertThat(result.excludedSourceId()).isNull();
        assertThat(result.blockers()).containsExactly(
                "OWNER_DUPLICATE_PRODUCT_SELECTION_UNRESOLVED");
    }

    @Test
    void failsClosedAndReportsBothTimestampsWhenActualLatestDiffersFromExpected() {
        LocalDateTime actualLatest = LocalDateTime.parse("2026-05-12T02:24:46");
        LocalDateTime expectedButOlder = LocalDateTime.parse("2026-03-26T18:26:04");

        var result = new LiveDuplicateProductSelectionPlanner().plan(
                duplicateSource(actualLatest, expectedButOlder), duplicatePolicy());

        assertThat(result.selectedSourceId()).isNull();
        assertThat(result.excludedSourceId()).isNull();
        assertThat(result.plan().postModifiedGmt()).containsEntry(41038L, actualLatest)
                .containsEntry(41181L, expectedButOlder);
        assertThat(result.plan().reasons()).contains(
                "Latest post_modified_gmt selected source 41038, not expected source 41181");
        assertThat(result.blockers()).containsExactly(
                "OWNER_DUPLICATE_PRODUCT_SELECTION_UNRESOLVED");
    }

    @Test
    void preservesNullSourceMetaWhileBuildingFailClosedDuplicateContext() {
        Map<String, String> sourceMeta = new LinkedHashMap<>();
        sourceMeta.put("_sku", "SCS-S10X");
        sourceMeta.put("_optional_null", null);

        Map<String, String> copied =
                LiveMigrationPreflightService.immutableMapAllowingNullValues(sourceMeta);

        assertThat(copied).containsEntry("_sku", "SCS-S10X")
                .containsEntry("_optional_null", null);
    }

    @Test
    void infersUniqueModelExactBrandAndExplicitGenderTokens() {
        WpPost post = post(1, "Mũ bảo hiểm LS2 FF800 Nữ");
        var planner = inferencePlanner(List.of(post), target(List.of(), List.of()));

        var result = planner.infer(
                post, null, List.of(), List.of(), null, List.of(), List.of());

        assertThat(result.sku()).isEqualTo("FF800");
        assertThat(result.brandSlug()).isEqualTo("ls2");
        assertThat(result.gender()).isEqualTo("Nữ");
        assertThat(result.manualFields()).isEmpty();
        assertThat(result.plans()).extracting(plan -> plan.decision())
                .containsOnly("APPLIED");
        assertThat(result.plans()).allSatisfy(plan -> {
            assertThat(plan.sourceId()).isEqualTo(1L);
            assertThat(plan.sourceValue()).contains("LS2 FF800 Nữ");
            assertThat(plan.evidence()).isNotBlank();
            assertThat(plan.ruleId()).isNotBlank();
            assertThat(plan.confidence()).isNotBlank();
        });
    }

    @Test
    void usesBrandFallbackAndNeutralAccessoryWhitelistWithAuditRows() {
        WpPost post = post(2, "Giá đỡ điện thoại Q30");
        var planner = inferencePlanner(List.of(post), target(List.of(), List.of()));

        var result = planner.infer(
                post, null, List.of(), List.of(), null, List.of(),
                List.of("phu-kien-gia-do-dien-thoai"));

        assertThat(result.sku()).isEqualTo("Q30");
        assertThat(result.brandSlug()).isEqualTo("uncategorized-brand");
        assertThat(result.gender()).isNull();
        assertThat(result.plans()).anySatisfy(plan -> {
            assertThat(plan.field()).isEqualTo("brandId");
            assertThat(plan.decision()).isEqualTo("FALLBACK_APPLIED");
            assertThat(plan.manualFollowUp()).isTrue();
        });
    }

    @Test
    void sortsAmbiguousBrandCandidatesBeforeWritingAuditEvidence() {
        WpPost post = post(25, "Alpha Zeta A100");
        Map<String, String> aliases = new LinkedHashMap<>();
        aliases.put("zeta", "uncategorized-brand");
        aliases.put("alpha", "ls2");
        ProductInference base = inferencePolicy();
        ProductInference policy = new ProductInference(
                base.enabled(), base.brandRuleId(), base.brandFallbackSlug(), aliases,
                base.genderTokenRuleId(), base.femaleTokens(), base.maleTokens(),
                base.unisexTokens(), base.neutralCategoryRuleId(),
                base.unisexNeutralSourceCategorySlugs(), base.skuRuleId(),
                base.skuIgnoredTokens(), base.manualFieldOverrides());
        var source = new LiveWordPressSnapshotReader.Snapshot(
                Map.of(post.id(), post), Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                List.of(), List.of(), Map.of(), List.of());
        var planner = new LiveProductInferencePlanner(
                policy, source, target(List.of(), List.of()), List.of(post));

        var result = planner.infer(
                post, "KNOWN-SKU", List.of(), List.of(), null, List.of("unisex"), List.of());

        assertThat(result.plans()).filteredOn(plan -> "brandId".equals(plan.field()))
                .singleElement().satisfies(plan -> assertThat(plan.evidence())
                        .contains("candidates=[ls2, uncategorized-brand]"));
    }

    @Test
    void appliesAllExplicitGenderTokenGroupsAndExactHelmetWhitelist() {
        WpPost male = post(21, "Áo moto Nam M100");
        WpPost unisex = post(22, "Áo mưa Unisex U200");
        WpPost helmet = post(23, "Mũ bảo hiểm H300");
        WpPost armor = post(24, "Giáp gối A400");

        assertThat(inferencePlanner(List.of(male), target(List.of(), List.of()))
                .infer(male, "M100", List.of(), List.of(), null, List.of(), List.of())
                .gender()).isEqualTo("Nam");
        assertThat(inferencePlanner(List.of(unisex), target(List.of(), List.of()))
                .infer(unisex, "U200", List.of(), List.of(), null, List.of(), List.of())
                .gender()).isNull();
        var helmetResult = inferencePlanner(List.of(helmet), target(List.of(), List.of()))
                .infer(helmet, "H300", List.of(), List.of(), null, List.of(),
                        List.of("mu-bao-hiem-fullface"));
        assertThat(helmetResult.gender()).isNull();
        assertThat(helmetResult.plans()).filteredOn(plan -> "gender".equals(plan.field()))
                .singleElement().satisfies(plan -> {
                    assertThat(plan.ruleId()).isEqualTo(
                            "GENDER_NEUTRAL_EQUIPMENT_CATEGORY_V2");
                    assertThat(plan.confidence()).isEqualTo("MEDIUM");
                    assertThat(plan.evidence()).contains("mu-bao-hiem-fullface");
                });
        assertThat(inferencePlanner(List.of(armor), target(List.of(), List.of()))
                .infer(armor, "A400", List.of(), List.of(), null, List.of(),
                        List.of("giap-bao-ho-tay-chan-dai-lung-phu-kien-giap"))
                .gender()).isNull();
    }

    @Test
    void leavesAmbiguousSkuAndApparelGenderForManualResolution() {
        WpPost post = post(3, "Áo giáp ABC100 XYZ200");
        var planner = inferencePlanner(List.of(post), target(List.of(), List.of()));

        var result = planner.infer(
                post, null, List.of(), List.of(), null, List.of(), List.of("ao-giap"));

        assertThat(result.sku()).isNull();
        assertThat(result.gender()).isNull();
        assertThat(result.manualFields()).containsExactlyInAnyOrder("sku", "gender");
        assertThat(result.plans()).filteredOn(plan -> "MANUAL_REVIEW".equals(plan.decision()))
                .extracting(plan -> plan.field()).containsExactlyInAnyOrder("sku", "gender");
    }

    @Test
    void rejectsAnInferredSkuAlreadyUsedByATargetVariant() {
        WpPost post = post(4, "Thiết bị ABC100");
        TargetVariant existing = new TargetVariant(
                "variant-1", "product-1", "ABC100", "Existing", null, null,
                null, null, 0, "OUT_OF_STOCK", false, 0, 0);
        var planner = inferencePlanner(List.of(post), target(List.of(existing), List.of()));

        var result = planner.infer(
                post, null, List.of(), List.of(), null, List.of(),
                List.of("phu-kien-gia-do-dien-thoai"));

        assertThat(result.sku()).isNull();
        assertThat(result.plans()).anySatisfy(plan -> {
            if ("sku".equals(plan.field())) {
                assertThat(plan.uniquenessCheck()).contains("targetNormalizedOccurrences=1");
                assertThat(plan.decision()).isEqualTo("MANUAL_REVIEW");
            }
        });
    }

    @Test
    void canonicalMediaPriorityIsIntegrityThenReferencesAuditAgeAndId() {
        String sha = "a".repeat(64);
        var validOld = checksum("media-a", sha, List.of("Verified content is duplicated"), 100L);
        var validNew = checksum("media-b", sha, List.of("Verified content is duplicated"), 100L);
        var missing = checksum(
                "media-c", sha, List.of("Target object could not be read and hashed"), 100L);
        Map<String, TargetMedia> media = Map.of(
                "media-a", media("media-a", Instant.parse("2026-01-01T00:00:00Z"), 1, 0),
                "media-b", media("media-b", Instant.parse("2026-02-01T00:00:00Z"), 8, 1),
                "media-c", media("media-c", Instant.parse("2025-01-01T00:00:00Z"), 20, 10));

        TargetMediaChecksumPlan selected = new LiveTargetMediaCleanupPlanner().selectCanonical(
                List.of(missing, validOld, validNew), media,
                Map.of("media-a", 9, "media-b", 2, "media-c", 99));

        assertThat(selected.targetMediaId()).isEqualTo("media-a");
    }

    private LiveProductInferencePlanner inferencePlanner(
            List<WpPost> posts,
            LiveTargetSnapshotReader.Snapshot target) {
        Map<Long, WpPost> byId = posts.stream().collect(java.util.stream.Collectors.toMap(
                WpPost::id, value -> value));
        var source = new LiveWordPressSnapshotReader.Snapshot(
                byId, Map.of(), Map.of(), Map.of(), Map.of(), Map.of(),
                List.of(), List.of(), Map.of(), List.of());
        return new LiveProductInferencePlanner(inferencePolicy(), source, target, posts);
    }

    private ProductInference inferencePolicy() {
        return new ProductInference(
                true, "BRAND_EXACT_TARGET_TOKEN_OR_FALLBACK_V1", "uncategorized-brand", Map.of(),
                "GENDER_EXACT_TOKEN_V1", List.of("nữ", "lady", "women", "female"),
                List.of("nam", "man", "men", "male"), List.of("unisex"),
                "GENDER_NEUTRAL_EQUIPMENT_CATEGORY_V2",
                List.of("phu-kien-gia-do-dien-thoai", "mu-bao-hiem-fullface",
                        "giap-bao-ho-tay-chan-dai-lung-phu-kien-giap"),
                "SKU_UNIQUE_CLEAR_MODEL_CODE_V1", List.of("2K", "4K", "V2", "V3"),
                List.of());
    }

    private LiveTargetSnapshotReader.Snapshot target(
            List<TargetVariant> variants,
            List<TargetMedia> media) {
        return new LiveTargetSnapshotReader.Snapshot(
                "public", "370", false, true, true,
                List.of(), variants, List.of(), Map.of(), List.of(),
                List.of(
                        new TargetBrand("brand-ls2", "ls2", "LS2", true, null),
                        new TargetBrand("brand-fallback", "uncategorized-brand",
                                "Uncategorized Brand", false, null)),
                media, List.of(), Map.of(), 0);
    }

    private LiveWordPressSnapshotReader.Snapshot duplicateSource(
            LocalDateTime first,
            LocalDateTime second) {
        WpPost old = post(41038, "Tai nghe SCS S10X cũ");
        WpPost latest = post(41181, "Tai nghe SCS S10X mới");
        return new LiveWordPressSnapshotReader.Snapshot(
                Map.of(old.id(), old, latest.id(), latest),
                Map.of(old.id(), first, latest.id(), second),
                Map.of(
                        old.id(), List.of(new WpPostMeta(1, old.id(), "_sku", "SCS-S10X")),
                        latest.id(), List.of(new WpPostMeta(2, latest.id(), "_sku", "SCS-S10X"))),
                Map.of(), Map.of(), Map.of(), List.of(), List.of(), Map.of(), List.of());
    }

    private DuplicateProductSelection duplicatePolicy() {
        return new DuplicateProductSelection(
                "SCS-S10X", List.of(41038L, 41181L), "LATEST_POST_MODIFIED_GMT",
                41181L, false, "DRAFT",
                "RELATED_CATEGORY_OR_ACKNOWLEDGED_NO_SAFE_TARGET");
    }

    private WpPost post(long id, String title) {
        return new WpPost(
                id, 1L, null, null, "", title, "", "publish", "closed",
                "source-" + id, "product", 0L, 0, "", "", 0L);
    }

    private TargetMediaChecksumPlan checksum(
            String id, String sha, List<String> reasons, long bytes) {
        return new TargetMediaChecksumPlan(
                id, "bucket", "key/" + id, sha, bytes, Action.CONFLICT, reasons);
    }

    private TargetMedia media(String id, Instant createdAt, int audits, int adminAudits) {
        return new TargetMedia(
                id, null, "key/" + id, "/media/key/" + id, "MINIO", "bucket",
                "image/jpeg", 100L, "a".repeat(64), createdAt, audits, adminAudits);
    }
}
