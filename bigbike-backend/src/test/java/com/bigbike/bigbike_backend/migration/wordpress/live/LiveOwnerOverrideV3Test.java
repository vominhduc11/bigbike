package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectPlan;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Pins the four data decisions the owner made on 2026-08-05. */
class LiveOwnerOverrideV3Test {

    private static final Path V3 = Path.of(System.getProperty("user.dir"))
            .resolve("../deploy/migration/live-migration-owner-overrides-v3.json")
            .normalize();

    @Test
    void loadsTheFourReviewedDecisionsWithoutWideningAnyOfThem() throws Exception {
        var config = new LiveMigrationOwnerOverrides().load(V3).config();

        assertThat(config.version()).isEqualTo(3);
        assertThat(config.ownerDecisionDate()).isEqualTo("2026-08-05");

        var duplicate = config.duplicateProductSelection();
        assertThat(duplicate.expectedSelectedSourceId()).isEqualTo(41038L);
        assertThat(duplicate.mergeAllowed()).isTrue();
        // The migration never publishes anything; the owner publishes from the admin instead.
        assertThat(duplicate.selectedProductStatus()).isEqualTo("DRAFT");

        var inference = config.productInference();
        assertThat(inference.manualFieldOverrides()).hasSize(25)
                .allSatisfy(row -> {
                    assertThat(row.field()).isEqualTo("gender");
                    assertThat(row.value()).isEqualTo("Unisex");
                    assertThat(row.ruleId()).isEqualTo("OWNER_MANUAL_GENDER_V3");
                });
        assertThat(inference.productCategoryOverrides()).hasSize(25)
                .containsEntry(41038L, List.of("tai-nghe-bluetooth-mu-bao-hiem"))
                .containsEntry(26955L, List.of("do-lot-the-thao-trum-dau-moto"))
                .containsEntry(28387L, List.of("phu-kien-moto-khac"))
                // "Áo Bảo Hộ Vải" is deleted in the target, so these move to the live parent.
                .containsEntry(29790L, List.of("ao-quan-bao-ho"));

        var generation = config.variantSkuGeneration();
        // 38 parents visible in the reviewed plan plus the 17 that only surface once the
        // gender/category decisions release their parent from manual review.
        assertThat(generation.parentSourceIds()).hasSize(55).doesNotContain(26942L, 41359L);
        assertThat(generation.retainedManualParentSourceIds())
                .containsExactlyInAnyOrder(26942L, 30587L, 34009L, 38771L, 39532L, 40513L, 41359L);
        assertThat(generation.skippedDuplicateVariantSourceIds())
                .containsExactlyInAnyOrder(35273L, 35275L);

        assertThat(config.translationMerge().pairs())
                .containsExactlyInAnyOrderEntriesOf(Map.of(41038L, 41181L, 41070L, 41176L));
        assertThat(config.sourceTranslationOverrides())
                .extracting(LiveMigrationOwnerOverrides.SourceTranslationOverride::sourceId)
                .containsExactlyInAnyOrder(36670L, 36698L, 36725L, 41190L);
        assertThat(config.sourceTranslationOverrides())
                .allSatisfy(row -> {
                    assertThat(row.nameVi()).isNotBlank();
                    assertThat(row.descriptionVi()).isNotBlank();
                    // The English original must survive: it is what lands in the *_en columns.
                    assertThat(row.evidence()).isNotBlank();
                });

        assertThat(config.targetContent().unlinkDeadAnchorsInStructuredContent()).isTrue();
        assertThat(config.targetContent().removeStructuredUrls()).isFalse();
    }

    @Test
    void refusesAProductCategoryOverrideThatResolvesToUncategorized() throws Exception {
        var config = new LiveMigrationOwnerOverrides().load(V3).config();
        Map<Long, List<String>> broken =
                new LinkedHashMap<>(config.productInference().productCategoryOverrides());
        broken.put(41038L, List.of("uncategorized"));

        assertThatThrownBy(() -> validateCategories(broken))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("uncategorized");
    }

    private void validateCategories(Map<Long, List<String>> overrides) throws Exception {
        var method = LiveMigrationOwnerOverrides.class.getDeclaredMethod(
                "validateProductCategoryOverrides", int.class, Map.class);
        method.setAccessible(true);
        try {
            method.invoke(new LiveMigrationOwnerOverrides(), 3, overrides);
        } catch (java.lang.reflect.InvocationTargetException e) {
            throw (Exception) e.getCause();
        }
    }

    @Test
    void buildsAStableVariantSkuFromTheParentAndTheOptionValues() {
        Set<String> reserved = new LinkedHashSet<>();

        assertThat(LiveMigrationPreflightService.generateVariantSku(
                "FF800OB", Map.of("color", "cam", "size", "l"), reserved))
                .isEqualTo("FF800OB-CAM-L");
        // Attribute order in the map must not matter; options sort by attribute name.
        assertThat(LiveMigrationPreflightService.generateVariantSku(
                "BULL-LADY", new LinkedHashMap<>(Map.of(
                        "size", "xl", "gender", "nu", "color", "nau")), reserved))
                .isEqualTo("BULL-LADY-NAU-NU-XL");
        // Vietnamese diacritics are stripped, not transliterated away.
        assertThat(LiveMigrationPreflightService.generateVariantSku(
                "LS2-MX702", Map.of("color", "Đen Đỏ Trắng", "size", "XXL"), reserved))
                .isEqualTo("LS2-MX702-DENDOTRANG-XXL");
    }

    @Test
    void refusesToInventASkuWhenThereIsNoEvidenceOrTheResultIsTaken() {
        assertThat(LiveMigrationPreflightService.generateVariantSku(
                null, Map.of("color", "den"), Set.of())).isNull();
        assertThat(LiveMigrationPreflightService.generateVariantSku(
                "FF800OB", Map.of(), Set.of())).isNull();
        assertThat(LiveMigrationPreflightService.generateVariantSku(
                "FF800OB", Map.of("color", "cam", "size", "l"), Set.of("FF800OB-CAM-L")))
                .isNull();
    }

    @Test
    void unlinksDeadAnchorsInsideJsonBlocksWhileLeavingPlainStructuredUrlsAlone() {
        var rewriter = new LiveMigrationContentRewriter(List.of(new RedirectPlan(
                "/sp/khong-co-dich.html", null, "PRODUCT", 10L,
                "owner acknowledged", "MANUAL_REVIEW", Action.ACKNOWLEDGED_NO_SAFE_TARGET,
                null, null, null, null, List.of("No safe target"))));
        var policy = new LiveMigrationOwnerOverrides.TargetContentPolicy(
                true, true, false, false, false, List.of(), true);

        // Exactly how a paragraph block renders as text: the href quotes arrive escaped.
        String blocks = "[{\"type\": \"paragraph\", \"html\": \"<p>Xem "
                + "<a href=\\\"https://bigbike.vn/sp/khong-co-dich.html\\\">"
                + "<span>Mũ cũ</span></a> tại đây</p>\"},"
                + " {\"type\": \"image\", \"url\": \"/vi/sp/khong-co-dich.html\"}]";

        var result = rewriter.rewriteTargetField(
                blocks, Map.of(), "ARTICLE", "wp-art-1", "body_blocks", false,
                policy, List.of());

        assertThat(result.unlinkedDeadAnchors()).isEqualTo(1);
        assertThat(result.value()).contains("<p>Xem <span>Mũ cũ</span> tại đây</p>");
        assertThat(result.value()).doesNotContain("<a href");
        // A structured URL that is not an anchor stays byte-for-byte, escaping included.
        assertThat(result.value())
                .contains("{\"type\": \"image\", \"url\": \"/vi/sp/khong-co-dich.html\"}");
    }

    @Test
    void leavesJsonBlocksUntouchedWhileTheStructuredSwitchIsOff() {
        var rewriter = new LiveMigrationContentRewriter(List.of(new RedirectPlan(
                "/sp/khong-co-dich.html", null, "PRODUCT", 10L,
                "owner acknowledged", "MANUAL_REVIEW", Action.ACKNOWLEDGED_NO_SAFE_TARGET,
                null, null, null, null, List.of("No safe target"))));
        var policy = new LiveMigrationOwnerOverrides.TargetContentPolicy(
                true, true, false, false, false);
        String blocks = "[{\"html\": \"<a href=\\\"/sp/khong-co-dich.html\\\">Mũ cũ</a>\"}]";

        var result = rewriter.rewriteTargetField(
                blocks, Map.of(), "ARTICLE", "wp-art-1", "body_blocks", false,
                policy, List.of());

        assertThat(result.value()).isEqualTo(blocks);
        assertThat(result.unlinkedDeadAnchors()).isZero();
    }
}
