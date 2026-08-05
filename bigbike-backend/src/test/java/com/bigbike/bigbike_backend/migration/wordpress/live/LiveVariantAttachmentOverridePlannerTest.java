package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationOwnerOverrides.VariantAttachmentOverride;
import java.util.List;
import org.junit.jupiter.api.Test;

class LiveVariantAttachmentOverridePlannerTest {

    @Test
    void removesOnlyAttachment30184AndKeepsExecutionBoundToTheReviewedList() {
        var planner = new LiveVariantAttachmentOverridePlanner(List.of(policy(30187L)));

        var result = planner.plan(
                30187L, 30183L, 30186L, List.of(30184L, 30185L));

        assertThat(result.overridePresent()).isTrue();
        assertThat(result.valid()).isTrue();
        assertThat(result.galleryAttachmentIds()).containsExactly(30185L);
        assertThat(result.reasons()).containsExactly(
                "OWNER_OVERRIDE_REMOVE_EXACT_MISSING_GALLERY_REFERENCE:30187:30184");
        assertThat(LiveVariantAttachmentOverridePlanner.reviewedGalleryForExecution(
                List.of(30186L, 30185L), List.of(30184L, 30185L)))
                .containsExactly(30185L);
    }

    @Test
    void failsClosedWhenAnyReviewedAttachmentEvidenceDrifts() {
        var planner = new LiveVariantAttachmentOverridePlanner(List.of(policy(30188L)));

        var result = planner.plan(
                30188L, 30183L, 99999L, List.of(30184L, 30185L));

        assertThat(result.overridePresent()).isTrue();
        assertThat(result.valid()).isFalse();
        assertThat(result.galleryAttachmentIds()).containsExactly(30184L, 30185L);
        assertThat(result.reasons()).singleElement().asString().contains("thumbnail changed");
    }

    private VariantAttachmentOverride policy(long variantId) {
        return new VariantAttachmentOverride(
                variantId, 30183L, 30186L,
                List.of(30184L, 30185L), List.of(30185L),
                "REMOVE_EXACT_MISSING_GALLERY_REFERENCE", "Owner confirmed exact removal");
    }
}
