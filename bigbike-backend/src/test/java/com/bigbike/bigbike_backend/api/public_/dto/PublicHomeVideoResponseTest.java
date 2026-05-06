package com.bigbike.bigbike_backend.api.public_.dto;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.video.HomeVideo;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class PublicHomeVideoResponseTest {

    @Test
    void from_buildsYoutubeEmbedAndThumbnailUrls() {
        HomeVideo video = new HomeVideo(
                "hv_demo",
                0,
                "Demo video",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                "dQw4w9WgXcQ",
                new ImageAsset(null, "/media/thumb.jpg", "Thumb", 1280, 720, "image/jpeg"),
                true,
                Instant.now(),
                Instant.now()
        );

        PublicHomeVideoResponse response = PublicHomeVideoResponse.from(video);

        assertThat(response.embedUrl()).isEqualTo("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0");
        assertThat(response.autoThumbnailUrl()).isEqualTo("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
        assertThat(response.thumbnail()).isNotNull();
    }
}
