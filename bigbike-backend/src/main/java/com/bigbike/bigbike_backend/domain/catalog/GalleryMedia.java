package com.bigbike.bigbike_backend.domain.catalog;

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
        String mediaType,
        ImageAsset image,
        String videoUrl,
        String videoProvider
) {
    public static GalleryMedia ofImage(ImageAsset image) {
        return new GalleryMedia("image", image, null, null);
    }

    public static GalleryMedia ofVideo(ImageAsset thumbnail, String videoUrl, String videoProvider) {
        return new GalleryMedia("video", thumbnail, videoUrl, videoProvider);
    }
}
