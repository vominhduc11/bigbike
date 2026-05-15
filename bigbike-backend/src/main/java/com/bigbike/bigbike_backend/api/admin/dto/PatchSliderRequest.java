package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
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
public class PatchSliderRequest {

    @Pattern(regexp = "^[a-z0-9_-]+$", message = "Invalid location.")
    private String location;

    @Min(value = 0, message = "sortOrder must be >= 0.")
    private Integer sortOrder;

    private Boolean isActive;

    @Valid
    private ImageAssetRequest desktopImage;

    @Valid
    private ImageAssetRequest mobileImage;

    @Size(max = 64, message = "productId is too long.")
    private String productId;

    @Size(max = 2048, message = "externalLink is too long.")
    private String externalLink;

    /** True when the payload is a full edit (location is present). */
    public boolean isFullEdit() {
        return location != null;
    }
}
