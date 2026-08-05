package com.bigbike.bigbike_backend.migration.wordpress.live;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.Action;
import com.bigbike.bigbike_backend.migration.wordpress.live.LiveMigrationPreflightReport.RedirectPlan;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class LiveMigrationContentRewriterTest {

    private final LiveMigrationContentRewriter rewriter = new LiveMigrationContentRewriter(List.of(
            new RedirectPlan(
                    "/sp/mu-cu.html", "/product/mu-moi/", 301, "PRODUCT", 7L,
                    "legacy product", "EXACT", Action.INSERT,
                    null, null, null, null, null, null, List.of()),
            new RedirectPlan(
                    "/tin-tuc/bai-cu.html", "/tin-tuc/bai-moi/", 301, "ARTICLE", 8L,
                    "legacy article", "EXACT", Action.INSERT,
                    null, null, null, null, null, null, List.of()),
            new RedirectPlan(
                    "/sp/redirect-cu.html", "/product/redirect-moi/", 301, "FG_REDIRECT", 9L,
                    "reviewed redirect repair", "EXACT", Action.UPDATE_REDIRECT_TARGET,
                    "11111111-1111-1111-1111-111111111111", "/sp/redirect-cu.html",
                    "/product/missing", "PERMANENT", 301, true, List.of()),
            new RedirectPlan(
                    "/sp/khong-co-dich.html", null, 301, "PRODUCT", 10L,
                    "owner acknowledged", "MANUAL_REVIEW", Action.ACKNOWLEDGED_NO_SAFE_TARGET,
                    null, null, null, null, null, null, List.of("No safe target")),
            new RedirectPlan(
                    "/tin-tuc/content-only.html", "/tin-tuc/", 301,
                    "TARGET_CONTENT_REFERENCE", 0L, "content-only", "SAFE_NEWS_LISTING_FALLBACK",
                    Action.REWRITE_URLS_ONLY, null, null, null, null, null, null, List.of())));

    @Test
    void rewritesOnlyVerifiedMediaAndMappedInternalLinksAndKeepsQuery() {
        String html = """
                <a href="https://bigbike.vn/sp/mu-cu.html?utm_source=old">Xem</a>
                <img src="/wp-content/uploads/2024/03/mu.jpg?size=large">
                <a href="https://external.example/sp/mu-cu.html">External</a>
                """;

        String result = rewriter.rewriteHtml(
                html, Map.of("2024/03/mu.jpg", "/media/migration/mu.jpg"));

        assertThat(result).contains("/product/mu-moi/?utm_source=old");
        assertThat(result).contains("src=\"/media/migration/mu.jpg\"");
        assertThat(result).contains("https://external.example/sp/mu-cu.html");
        assertThat(result).doesNotContain("wp-content/uploads");
    }

    @Test
    void usesReviewedExistingRedirectUpdatesForContentRewrites() {
        assertThat(rewriter.rewriteHtml(
                "<a href=\"/sp/redirect-cu.html\">Old</a>", Map.of()))
                .contains("href=\"/product/redirect-moi/\"");
    }

    @Test
    void canonicalIsChangedOnlyWhenSourceCanonicalExists() {
        assertThat(rewriter.rewriteCanonical(null, "/product/mu-moi/")).isNull();
        assertThat(rewriter.rewriteCanonical(
                "https://bigbike.vn/sp/mu-cu.html", "/product/mu-moi/"))
                .isEqualTo("https://bigbike.vn/product/mu-moi/");
        assertThat(rewriter.rewriteCanonical(
                "https://external.example/reference", "/product/mu-moi/"))
                .isEqualTo("https://external.example/reference");
    }

    @Test
    void auditsLegacyUrlsInsideJsonAndDoesNotClassifyCanonicalEnglishRoutesAsLegacy() {
        String json = """
                {"html":"<a href=\"/vi/tin-tuc/bai-cu.html\">VI</a>",
                 "image":"https://bigbike.vn/wp-content/uploads/2024/03/a+b%20c.jpg?x=1",
                 "english":"/en/tin-tuc/current-article/"}
                """;

        assertThat(LiveMigrationContentRewriter.wordpressUploadPaths(json))
                .containsExactly("2024/03/a+b c.jpg");
        assertThat(LiveMigrationContentRewriter.wordpressUploadLinkCount(json)).isEqualTo(1);
        assertThat(LiveMigrationContentRewriter.legacyInternalLinkCount(json)).isEqualTo(1);
        assertThat(LiveMigrationContentRewriter.legacyInternalPaths(json))
                .containsExactly("/vi/tin-tuc/bai-cu.html");
        assertThat(LiveMigrationContentRewriter.legacyInternalLinkCount(
                "<a href=\"/en/tin-tuc/current-article/\">Current</a>"))
                .isZero();
    }

    @Test
    void doesNotClassifyVideoPathsOrThirdPartyWordpressUploadsAsInternalLegacyUrls() {
        String html = """
                <video src="/video/demo.mp4"></video>
                <a href="https://external.example/video/demo">External video</a>
                <img src="https://external.example/wp-content/uploads/shared/logo.png">
                """;

        assertThat(LiveMigrationContentRewriter.legacyInternalLinkCount(html)).isZero();
        assertThat(LiveMigrationContentRewriter.wordpressUploadLinkCount(html)).isZero();
        assertThat(LiveMigrationContentRewriter.wordpressUploadPaths(html)).isEmpty();
    }

    @Test
    void rewritesLocalePrefixedLegacyRoutesInOneStep() {
        String html = """
                <a href="/vi/tin-tuc/bai-cu.html?utm_source=vi">VI</a>
                <a href="/en/sp/mu-cu.html#size">EN</a>
                <a href="/en/products/current-product/">Old EN contract</a>
                """;

        String result = rewriter.rewriteHtml(html, Map.of());

        assertThat(result).contains("/tin-tuc/bai-moi/?utm_source=vi");
        assertThat(result).contains("/en/product/mu-moi/#size");
        assertThat(result).contains("/en/product/current-product/");
        assertThat(LiveMigrationContentRewriter.legacyInternalLinkCount(result)).isZero();
    }

    @Test
    void excludesJsonEscapeBackslashFromCapturedUrls() {
        String json = "{\"image\":\"https://bbi.vn/wp-content/uploads/2024/03/a.jpg\"}";

        assertThat(LiveMigrationContentRewriter.wordpressUploadPaths(json))
                .containsExactly("2024/03/a.jpg");
        assertThat(rewriter.rewriteHtml(json, Map.of("2024/03/a.jpg", "/media/a.jpg")))
                .isEqualTo("{\"image\":\"/media/a.jpg\"}");
    }

    @Test
    void unlinksOnlyAcknowledgedInternalAnchorsAndPreservesAnchorContent() {
        String html = """
                <p><a class="old" href="/sp/khong-co-dich.html"><strong>Giữ chữ này</strong></a></p>
                <p>/sp/khong-co-dich.html</p>
                <a href="https://external.example/sp/khong-co-dich.html">External</a>
                """;

        String result = rewriter.rewriteHtml(html, Map.of());

        assertThat(result).contains("<strong>Giữ chữ này</strong>");
        assertThat(result).doesNotContain("class=\"old\"");
        assertThat(result).contains("<p>/sp/khong-co-dich.html</p>");
        assertThat(result).contains("https://external.example/sp/khong-co-dich.html");
    }

    @Test
    void handlesLocalizedAcknowledgmentAndNeverUnlinksStructuredOrPlainTextUrls() {
        String html = "<a href=\"/vi/sp/khong-co-dich.html\"><em>Giữ nội dung</em></a>"
                + " /vi/sp/khong-co-dich.html";
        var policy = new LiveMigrationOwnerOverrides.TargetContentPolicy(
                true, true, false, false, false);

        var htmlResult = rewriter.rewriteTargetField(
                html, Map.of(), "ARTICLE", "wp-art-1", "body", true,
                policy, List.of());
        String structured = "{\"href\":\"/vi/sp/khong-co-dich.html\"}";
        var structuredResult = rewriter.rewriteTargetField(
                structured, Map.of(), "ARTICLE", "wp-art-1", "body_blocks", false,
                policy, List.of());

        assertThat(htmlResult.value()).isEqualTo(
                "<em>Giữ nội dung</em> /vi/sp/khong-co-dich.html");
        assertThat(htmlResult.unlinkedDeadAnchors()).isEqualTo(1);
        assertThat(structuredResult.value()).isEqualTo(structured);
        assertThat(structuredResult.unlinkedDeadAnchors()).isZero();
    }

    @Test
    void appliesContentRewriteOnlyMappingsWithoutCreatingARedirectWrite() {
        assertThat(rewriter.rewriteHtml(
                "<a href=\"/tin-tuc/content-only.html\">Bài cũ</a>", Map.of()))
                .contains("href=\"/tin-tuc/\"");
    }

    @Test
    void removesOnlyTheExactDeadImageInTheReviewedArticleFields() {
        String relative = "2021/05/mua-giay-scoyco-alpinestar-1024x772.png";
        var policy = new LiveMigrationOwnerOverrides.TargetContentPolicy(
                true, true, false, false, false);
        var fallback = new LiveMigrationOwnerOverrides.UnavailableFileFallback(
                relative, "ARTICLE", "wp-art-26064", List.of("body", "body_en"),
                "REMOVE_EXACT_DEAD_IMAGE_ONLY");
        String html = "<p>Trước<a href=\"/wp-content/uploads/" + relative
                + "\"><img alt=\"dead\" src=\"https://bigbike.vn/wp-content/uploads/"
                + relative + "\"></a>Sau</p>";

        var result = rewriter.rewriteTargetField(
                html, Map.of(), "ARTICLE", "wp-art-26064", "body", true,
                policy, List.of(fallback));
        var wrongField = rewriter.rewriteTargetField(
                html, Map.of(), "ARTICLE", "wp-art-26064", "excerpt", true,
                policy, List.of(fallback));

        assertThat(result.value()).isEqualTo("<p>TrướcSau</p>");
        assertThat(result.removedDeadImages()).isEqualTo(1);
        assertThat(result.unlinkedDeadAnchors()).isEqualTo(1);
        assertThat(result.operations()).containsExactly(
                "REMOVE_EXACT_DEAD_IMAGE:" + relative + ":1",
                "UNLINK_EXACT_DEAD_MEDIA_ANCHOR:" + relative + ":1");
        assertThat(wrongField.value()).isEqualTo(html);
    }
}
