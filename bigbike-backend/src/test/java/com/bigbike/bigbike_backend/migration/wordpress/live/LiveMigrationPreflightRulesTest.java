package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.model.WpPost;
import com.bigbike.bigbike_backend.migration.wordpress.model.WpPostMeta;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LiveMigrationPreflightRulesTest {

    @Test
    void mapsOnlyDirectGenderTermsToCanonicalTargetValues() {
        assertThat(LiveMigrationPreflightService.mapDirectGender("nam")).isEqualTo("Nam");
        assertThat(LiveMigrationPreflightService.mapDirectGender("nu")).isEqualTo("Nữ");
        assertThat(LiveMigrationPreflightService.mapDirectGender("unisex")).isNull();
        assertThat(LiveMigrationPreflightService.mapDirectGender("ao-khoac-nu")).isNull();
        assertThat(LiveMigrationPreflightService.mapDirectGender(null)).isNull();
        assertThat(LiveMigrationPreflightService.resolveDirectGender(
                java.util.List.of("nam", "nu"))).isNull();
        assertThat(LiveMigrationPreflightService.resolveDirectGender(
                java.util.List.of("nam", "unknown"))).isNull();
    }

    @Test
    void mapsWooCommerceRegularAndSalePricesWithoutTurningSaleIntoRetail() {
        BigDecimal regular = new BigDecimal("2500000");
        BigDecimal current = new BigDecimal("1990000");
        BigDecimal sale = new BigDecimal("1990000");

        assertThat(LiveMigrationPreflightService.sourceRetailPrice(regular, current))
                .isEqualByComparingTo(regular);
        assertThat(LiveMigrationPreflightService.sourceSalePrice(regular, current, sale))
                .isEqualByComparingTo(sale);
    }

    @Test
    void rejectsNonPositiveOrNonDiscountSalePriceInsteadOfInventingAValue() {
        assertThat(LiveMigrationPreflightService.sourceRetailPrice(null, BigDecimal.ZERO)).isNull();
        assertThat(LiveMigrationPreflightService.sourceSalePrice(
                new BigDecimal("100"), new BigDecimal("100"), new BigDecimal("100"))).isNull();
        assertThat(LiveMigrationPreflightService.sourceSalePrice(
                new BigDecimal("100"), new BigDecimal("100"), BigDecimal.ZERO)).isNull();
    }

    @Test
    void derivesStableSchemaValidMediaUuidFromContentHash() {
        String hash = "a".repeat(64);

        String first = LiveMediaPlanner.deterministicMediaId(hash);
        String second = LiveMediaPlanner.deterministicMediaId(hash);

        assertThat(first).isEqualTo(second).matches(
                "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    @Test
    void normalizesWordPressMediaPathsWithoutFormDecodingLiteralPlusOrAllowingTraversal() {
        assertThat(LiveMediaPlanner.normalizeRelativePath(
                "https://bigbike.vn/wp-content/uploads/2024/08/a+b%20c.jpg?size=large"))
                .isEqualTo("2024/08/a+b c.jpg");
        assertThat(LiveMediaPlanner.normalizeRelativePath("../../etc/passwd")).isNull();
        assertThat(LiveMediaPlanner.normalizeRelativePath("2024/08/bad%00name.jpg")).isNull();
    }

    @Test
    void mapsLegacyVideoPostToExternalYouTubeInsteadOfTreatingItAsAnAttachment() {
        long videoId = 8_974L;
        long thumbnailId = 16_832L;
        WpPost video = post(videoId, "video", "", "Gắn túi GIVI");
        WpPost thumbnail = post(thumbnailId, "attachment", "image/jpeg", "Thumbnail");
        var source = new LiveWordPressSnapshotReader.Snapshot(
                Map.of(videoId, video, thumbnailId, thumbnail),
                Map.of(),
                Map.of(videoId, List.of(
                        new WpPostMeta(1, videoId, "youtube_url",
                                "https://www.youtube.com/watch?v=wiDaLImsv6Y"),
                        new WpPostMeta(2, videoId, "_thumbnail_id", Long.toString(thumbnailId)))),
                Map.of(), Map.of(), Map.of(), List.of(), List.of(), Map.of(), List.of());

        var result = new LiveMigrationPreflightService().resolveProductVideos(
                source, Map.of("videos_0_video", Long.toString(videoId)));

        assertThat(result.problems()).isEmpty();
        assertThat(result.videos()).singleElement().satisfies(mapped -> {
            assertThat(mapped.provider()).isEqualTo("youtube");
            assertThat(mapped.url()).isEqualTo("https://www.youtube.com/watch?v=wiDaLImsv6Y");
            assertThat(mapped.uploadAttachmentId()).isNull();
            assertThat(mapped.thumbnailAttachmentId()).isEqualTo(thumbnailId);
        });
    }

    @Test
    void reportsUnsupportedLegacyVideoUrlWithoutInventingAnUploadPath() {
        long videoId = 38_302L;
        WpPost video = post(videoId, "video", "", "Broken video");
        var source = new LiveWordPressSnapshotReader.Snapshot(
                Map.of(videoId, video),
                Map.of(),
                Map.of(videoId, List.of(new WpPostMeta(
                        1, videoId, "youtube_url", "https://example.com/not-youtube"))),
                Map.of(), Map.of(), Map.of(), List.of(), List.of(), Map.of(), List.of());

        var result = new LiveMigrationPreflightService().resolveProductVideos(
                source, Map.of("videos_0_video", Long.toString(videoId)));

        assertThat(result.videos()).isEmpty();
        assertThat(result.problems()).singleElement()
                .extracting(LiveMigrationPreflightService.VideoProblem::code)
                .isEqualTo("SOURCE_VIDEO_URL_INVALID");
    }

    private WpPost post(long id, String type, String mimeType, String title) {
        return new WpPost(
                id, 1L, null, null, "", title, "", "publish", "closed",
                "source-" + id, type, 0L, 0, "", mimeType, 0L);
    }
}
