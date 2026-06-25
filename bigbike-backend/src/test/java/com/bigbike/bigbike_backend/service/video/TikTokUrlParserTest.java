package com.bigbike.bigbike_backend.service.video;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class TikTokUrlParserTest {

    private static final String VIDEO_ID = "7251234567890123456";

    @Test
    void extractId_acceptsCanonicalUserVideoUrl() {
        assertThat(TikTokUrlParser.extractId("https://www.tiktok.com/@bigbike/video/" + VIDEO_ID))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_acceptsMobileVUrl() {
        assertThat(TikTokUrlParser.extractId("https://m.tiktok.com/v/" + VIDEO_ID + ".html"))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_acceptsEmbedUrl() {
        assertThat(TikTokUrlParser.extractId("https://www.tiktok.com/embed/v2/" + VIDEO_ID))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_rejectsShortLink() {
        // vt.tiktok.com short links carry no numeric id → must be rejected.
        assertThat(TikTokUrlParser.extractId("https://vt.tiktok.com/ZSabcDEF/"))
                .isNull();
    }

    @Test
    void extractId_rejectsHostSpoofing() {
        assertThat(TikTokUrlParser.extractId("https://evil.com/tiktok.com/@x/video/" + VIDEO_ID))
                .isNull();
    }

    @Test
    void extractId_rejectsUnsafeScheme() {
        assertThat(TikTokUrlParser.extractId("javascript:alert(1)"))
                .isNull();
    }

    @Test
    void extractId_rejectsMalformedUrl() {
        assertThat(TikTokUrlParser.extractId("https://www.tiktok.com/@bigbike/video/"))
                .isNull();
        assertThat(TikTokUrlParser.extractId("not a url"))
                .isNull();
    }

    @Test
    void embedUrl_buildsCanonicalEmbed() {
        assertThat(TikTokUrlParser.embedUrl(VIDEO_ID))
                .isEqualTo("https://www.tiktok.com/embed/v2/" + VIDEO_ID);
    }
}
