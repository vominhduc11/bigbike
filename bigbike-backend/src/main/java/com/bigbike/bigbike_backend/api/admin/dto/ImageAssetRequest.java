package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.constraints.Pattern;
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
public class ImageAssetRequest {

    @Size(max = 2048, message = "Image URL is too long.")
    // Empty string is allowed and means "clear the image" (handled by trimToNull in service layer).
    @Pattern(regexp = "^$|^(?:https?://|/).*", flags = Pattern.Flag.CASE_INSENSITIVE,
            message = "Image URL must use http/https or be a relative path.")
    private String url;

    @Size(max = 255, message = "Image alt is too long.")
    private String alt;

    private Integer width;
    private Integer height;

    @Size(max = 100, message = "Image mimeType is too long.")
    private String mimeType;
}
