package com.bigbike.bigbike_backend.service.video;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class YouTubeUrlParserTest {

    private static final String VIDEO_ID = "dQw4w9WgXcQ";

    @Test
    void extractId_acceptsWatchUrl() {
        assertThat(YouTubeUrlParser.extractId("https://www.youtube.com/watch?v=" + VIDEO_ID))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_acceptsShortUrl() {
        assertThat(YouTubeUrlParser.extractId("https://youtu.be/" + VIDEO_ID))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_acceptsEmbedUrl() {
        assertThat(YouTubeUrlParser.extractId("https://www.youtube.com/embed/" + VIDEO_ID))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_acceptsShortsUrl() {
        assertThat(YouTubeUrlParser.extractId("https://www.youtube.com/shorts/" + VIDEO_ID))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_acceptsNoCookieUrl() {
        assertThat(YouTubeUrlParser.extractId("https://www.youtube-nocookie.com/embed/" + VIDEO_ID))
                .isEqualTo(VIDEO_ID);
    }

    @Test
    void extractId_rejectsHostSpoofing() {
        assertThat(YouTubeUrlParser.extractId("https://evil.com/youtube.com/watch?v=" + VIDEO_ID))
                .isNull();
    }

    @Test
    void extractId_rejectsUnsafeScheme() {
        assertThat(YouTubeUrlParser.extractId("javascript:alert(1)"))
                .isNull();
    }

    @Test
    void extractId_rejectsMalformedUrl() {
        assertThat(YouTubeUrlParser.extractId("https://www.youtube.com/watch?v="))
                .isNull();
        assertThat(YouTubeUrlParser.extractId("not a url"))
                .isNull();
    }
}
