package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Size;
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

    // Loại media của dòng gallery (V248): "image" (mặc định khi null) hoặc "video".
    @Size(max = 8, message = "Gallery mediaType is too long.")
    private String mediaType;

    // Video item (V248): URL video + provider; `url`/`alt`/... phía dưới là thumbnail/poster (tuỳ chọn).
    @Size(max = 2048, message = "Gallery video URL is too long.")
    private String videoUrl;

    @Size(max = 16, message = "Gallery video provider is too long.")
    private String videoProvider;

    @Size(max = 2048, message = "Gallery image URL is too long.")
    private String url;

    @Size(max = 255, message = "Gallery image alt is too long.")
    private String alt;

    @Size(max = 500, message = "Gallery caption is too long.")
    private String caption;

    private Integer width;
    private Integer height;

    @Size(max = 100, message = "Gallery image mimeType is too long.")
    private String mimeType;

    private Integer sortOrder;
}
