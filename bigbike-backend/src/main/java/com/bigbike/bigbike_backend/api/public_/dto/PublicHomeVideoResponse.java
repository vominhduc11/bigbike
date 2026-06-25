package com.bigbike.bigbike_backend.api.public_.dto;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.video.HomeVideo;
import com.bigbike.bigbike_backend.service.video.FacebookUrlParser;
import com.bigbike.bigbike_backend.service.video.TikTokUrlParser;

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
    public static PublicHomeVideoResponse from(HomeVideo video, String lang) {
        String ytId = video.youtubeId();
        // youtubeId null → thử đọc nguồn khác từ videoUrl để dựng iframe embed.
        // TikTok/Facebook không có ảnh thumbnail công khai như YouTube → autoThumb null, dùng thumbnail admin chọn.
        String tiktokId = ytId == null ? TikTokUrlParser.extractId(video.videoUrl()) : null;
        String embedUrl;
        String autoThumb;
        if (ytId != null) {
            embedUrl = "https://www.youtube-nocookie.com/embed/" + ytId + "?autoplay=1&rel=0";
            autoThumb = "https://img.youtube.com/vi/" + ytId + "/hqdefault.jpg";
        } else if (tiktokId != null) {
            embedUrl = TikTokUrlParser.embedUrl(tiktokId);
            autoThumb = null;
        } else if (FacebookUrlParser.isFacebookVideoUrl(video.videoUrl())) {
            embedUrl = FacebookUrlParser.embedUrl(video.videoUrl());
            autoThumb = null;
        } else {
            embedUrl = null;
            autoThumb = null;
        }
        return new PublicHomeVideoResponse(
                video.id(),
                video.sortOrder(),
                pick(video.title(), video.titleEn(), lang),
                video.videoUrl(),
                ytId,
                embedUrl,
                autoThumb,
                video.thumbnail()
        );
    }

    /** EN-with-Vietnamese-fallback per PRODUCT_RULE_002: English only when present. */
    private static String pick(String base, String en, String locale) {
        return "en".equalsIgnoreCase(locale) && en != null && !en.isBlank() ? en : base;
    }
}
