package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.api.admin.dto.GalleryImageRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VideoRequest;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductFieldApplierVideoMetadataTest {

    @Test
    void storesStableIdAndAllProductVideoMetadata() {
        ProductEntity product = new ProductEntity();
        ProductFieldApplier.applyVideos(product, List.of(VideoRequest.builder()
                .id("6b2249a2-39c8-4e22-b73c-08e2bb5938a5")
                .url("https://www.youtube.com/watch?v=abcdefghijk")
                .provider("youtube")
                .title("Giới thiệu mũ")
                .titleEn("Helmet introduction")
                .description("Video giới thiệu chi tiết.")
                .descriptionEn("Detailed introduction video.")
                .durationSeconds(125)
                .uploadedOn(LocalDate.of(2026, 8, 20))
                .thumbnailUrl("/media/video-poster.jpg")
                .sortOrder(0)
                .build()));

        var video = product.getVideos().get(0);
        assertThat(video.id()).isEqualTo("6b2249a2-39c8-4e22-b73c-08e2bb5938a5");
        assertThat(video.titleEn()).isEqualTo("Helmet introduction");
        assertThat(video.description()).isEqualTo("Video giới thiệu chi tiết.");
        assertThat(video.descriptionEn()).isEqualTo("Detailed introduction video.");
        assertThat(video.durationSeconds()).isEqualTo(125);
        assertThat(video.uploadedOn()).isEqualTo(LocalDate.of(2026, 8, 20));
        assertThat(video.thumbnail().url()).isEqualTo("/media/video-poster.jpg");
    }

    @Test
    void storesTheSameMetadataForAGalleryVideo() {
        ProductEntity product = new ProductEntity();
        ProductFieldApplier.applyGallery(product, List.of(GalleryImageRequest.builder()
                .id("7b2249a2-39c8-4e22-b73c-08e2bb5938a5")
                .mediaType("video")
                .videoUrl("https://www.facebook.com/bigbike/videos/123456789")
                .videoProvider("facebook")
                .url("/media/facebook-poster.jpg")
                .title("Video Facebook")
                .titleEn("Facebook video")
                .description("Mô tả dưới video gallery.")
                .descriptionEn("Gallery video description.")
                .durationSeconds(65)
                .uploadedOn(LocalDate.of(2026, 8, 19))
                .sortOrder(0)
                .build()));

        var video = product.getGallery().get(0);
        assertThat(video.id()).isEqualTo("7b2249a2-39c8-4e22-b73c-08e2bb5938a5");
        assertThat(video.mediaType()).isEqualTo("video");
        assertThat(video.videoProvider()).isEqualTo("facebook");
        assertThat(video.description()).isEqualTo("Mô tả dưới video gallery.");
        assertThat(video.durationSeconds()).isEqualTo(65);
        assertThat(video.image().url()).isEqualTo("/media/facebook-poster.jpg");
    }
}
