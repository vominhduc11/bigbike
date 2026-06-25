package com.bigbike.bigbike_backend.service.video;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class FacebookUrlParserTest {

    @Test
    void accepts_pageVideosUrl() {
        assertThat(FacebookUrlParser.isFacebookVideoUrl("https://www.facebook.com/BigBike/videos/1234567890"))
                .isTrue();
    }

    @Test
    void accepts_watchUrl() {
        assertThat(FacebookUrlParser.isFacebookVideoUrl("https://www.facebook.com/watch/?v=1234567890"))
                .isTrue();
    }

    @Test
    void accepts_reelUrl() {
        assertThat(FacebookUrlParser.isFacebookVideoUrl("https://www.facebook.com/reel/1234567890"))
                .isTrue();
    }

    @Test
    void rejects_shortFbWatchLink() {
        assertThat(FacebookUrlParser.isFacebookVideoUrl("https://fb.watch/abcdEF123/"))
                .isFalse();
    }

    @Test
    void rejects_nonVideoFacebookUrl() {
        assertThat(FacebookUrlParser.isFacebookVideoUrl("https://www.facebook.com/BigBike/"))
                .isFalse();
    }

    @Test
    void rejects_hostSpoofing() {
        assertThat(FacebookUrlParser.isFacebookVideoUrl("https://evil.com/facebook.com/BigBike/videos/123"))
                .isFalse();
    }

    @Test
    void rejects_unsafeScheme() {
        assertThat(FacebookUrlParser.isFacebookVideoUrl("javascript:alert(1)"))
                .isFalse();
    }

    @Test
    void embedUrl_wrapsHrefInPluginsVideo() {
        String embed = FacebookUrlParser.embedUrl("https://www.facebook.com/BigBike/videos/1234567890");
        assertThat(embed)
                .startsWith("https://www.facebook.com/plugins/video.php?href=")
                .contains("show_text=false");
    }

    @Test
    void embedUrl_returnsNullForInvalid() {
        assertThat(FacebookUrlParser.embedUrl("https://fb.watch/abcdEF123/")).isNull();
    }
}
