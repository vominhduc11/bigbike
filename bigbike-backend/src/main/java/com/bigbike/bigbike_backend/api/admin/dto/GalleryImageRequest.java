package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GalleryImageRequest {

    @Pattern(regexp = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$", message = "Gallery video id must be a UUID.")
    private String id;

    // Loại media của dòng gallery (V248): "image" (mặc định khi null) hoặc "video".
    @Size(max = 8, message = "Gallery mediaType is too long.")
    private String mediaType;

    // Video item (V248): URL video + provider; `url`/`alt`/... phía dưới là thumbnail/poster (tuỳ chọn).
    @Size(max = 2048, message = "Gallery video URL is too long.")
    private String videoUrl;

    @Size(max = 16, message = "Gallery video provider is too long.")
    @Pattern(regexp = "youtube|tiktok|facebook|upload", message = "Gallery video provider is not supported.")
    private String videoProvider;

    @Size(max = 2048, message = "Gallery image URL is too long.")
    private String url;

    @Size(max = 255, message = "Gallery image alt is too long.")
    private String alt;

    private Integer width;
    private Integer height;

    @Size(max = 100, message = "Gallery image mimeType is too long.")
    private String mimeType;

    @Size(max = 255, message = "Gallery video title is too long.")
    private String title;

    @Size(max = 255, message = "English gallery video title is too long.")
    private String titleEn;

    @Size(max = 5000, message = "Gallery video description is too long.")
    private String description;

    @Size(max = 5000, message = "English gallery video description is too long.")
    private String descriptionEn;

    @PositiveOrZero(message = "Gallery video duration must not be negative.")
    private Integer durationSeconds;

    private LocalDate uploadedOn;

    private Integer sortOrder;
}
