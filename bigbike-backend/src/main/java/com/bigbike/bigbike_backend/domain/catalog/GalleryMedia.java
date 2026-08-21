package com.bigbike.bigbike_backend.domain.catalog;

import java.time.LocalDate;

/**
 * Một mục trong dải media (gallery) của sản phẩm hoặc biến thể (V248): ảnh HOẶC video.
 *
 * <ul>
 *   <li>{@code mediaType="image"} → {@code image} là ảnh; {@code videoUrl}/{@code videoProvider} null.</li>
 *   <li>{@code mediaType="video"} → {@code image} là thumbnail/poster (có thể null → web tự lấy
 *       auto-thumb YouTube / first-frame), {@code videoUrl} + {@code videoProvider} ("youtube"|"upload")
 *       là video.</li>
 * </ul>
 *
 * <p>Tách biệt với {@code product_videos} (mục "Video" riêng dưới PDP). Gallery video do admin đăng
 * CHUNG khu vực với ảnh thumbnail.
 */
public record GalleryMedia(
        String id,
        String mediaType,
        ImageAsset image,
        String videoUrl,
        String videoProvider,
        String title,
        String titleEn,
        String description,
        String descriptionEn,
        Integer durationSeconds,
        LocalDate uploadedOn
) {
    public static GalleryMedia ofImage(ImageAsset image) {
        return new GalleryMedia(null, "image", image, null, null, null, null, null, null, null, null);
    }

    public static GalleryMedia ofVideo(
            String id, ImageAsset thumbnail, String videoUrl, String videoProvider,
            String title, String titleEn, String description, String descriptionEn,
            Integer durationSeconds, LocalDate uploadedOn) {
        return new GalleryMedia(
                id, "video", thumbnail, videoUrl, videoProvider,
                title, titleEn, description, descriptionEn, durationSeconds, uploadedOn);
    }

    /** Historical migration compatibility; runtime assigns stable IDs on the next data migration. */
    public static GalleryMedia ofVideo(ImageAsset thumbnail, String videoUrl, String videoProvider) {
        return ofVideo(null, thumbnail, videoUrl, videoProvider, null, null, null, null, null, null);
    }
}
