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

    @Size(max = 2048, message = "Gallery image URL is too long.")
    private String url;

    @Size(max = 255, message = "Gallery image alt is too long.")
    private String alt;

    private Integer width;
    private Integer height;

    @Size(max = 100, message = "Gallery image mimeType is too long.")
    private String mimeType;

    private Integer sortOrder;
}
