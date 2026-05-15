package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
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
public class SeoMetaRequest {

    @Size(max = 255, message = "SEO title is too long.")
    private String title;

    @Size(max = 5000, message = "SEO description is too long.")
    private String description;

    @Size(max = 2048, message = "Canonical URL is too long.")
    private String canonicalUrl;

    @Valid
    private ImageAssetRequest ogImage;

    private Boolean noIndex;
}
