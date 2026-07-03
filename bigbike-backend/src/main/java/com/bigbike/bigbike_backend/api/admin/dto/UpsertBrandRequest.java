package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
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
public class UpsertBrandRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Pattern(regexp = SLUG_REGEX, message = "Slug format is invalid.")
    private String slug;

    @Size(max = 255, message = "Name is too long.")
    private String name;

    @Size(max = 5000, message = "Description is too long.")
    private String description;

    @Valid
    private ImageAssetRequest logo;

    @Valid
    private ImageAssetRequest banner;

    @Valid
    private ImageAssetRequest mobileBanner;

    @Valid
    private SeoMetaRequest seo;

    private Boolean visible;

    @Valid
    private BrandTranslationRequest translations;
}
