package com.bigbike.bigbike_backend.api.public_.dto;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.video.HomeVideo;

public record PublicHomeVideoResponse(
        String id,
        Integer sortOrder,
        String title,
        String videoUrl,
        String youtubeId,
        String embedUrl,
        String autoThumbnailUrl,
        ImageAsset thumbnail
) {
    public static PublicHomeVideoResponse from(HomeVideo video) {
        String ytId = video.youtubeId();
        String embedUrl = ytId != null
                ? "https://www.youtube-nocookie.com/embed/" + ytId + "?autoplay=1&rel=0"
                : null;
        String autoThumb = ytId != null
                ? "https://img.youtube.com/vi/" + ytId + "/hqdefault.jpg"
                : null;
        return new PublicHomeVideoResponse(
                video.id(),
                video.sortOrder(),
                video.title(),
                video.videoUrl(),
                ytId,
                embedUrl,
                autoThumb,
                video.thumbnail()
        );
    }
}
