package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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
public class UpsertSliderRequest {

    @NotBlank(message = "location is required.")
    @Pattern(regexp = "^[a-z0-9_-]+$", message = "Invalid location.")
    private String location;

    @NotNull(message = "sortOrder is required.")
    @Min(value = 0, message = "sortOrder must be greater than or equal to 0.")
    private Integer sortOrder;

    @Valid
    private ImageAssetRequest desktopImage;

    @Valid
    private ImageAssetRequest mobileImage;

    @Size(max = 64, message = "productId is too long.")
    private String productId;

    @Size(max = 2048, message = "externalLink is too long.")
    private String externalLink;

    private Boolean isActive;
}
