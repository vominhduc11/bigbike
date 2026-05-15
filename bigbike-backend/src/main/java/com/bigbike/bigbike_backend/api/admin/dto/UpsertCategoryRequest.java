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
public class UpsertCategoryRequest {

    @Pattern(regexp = "^[a-z0-9]+(?:-[a-z0-9]+)*$", message = "slug must be lowercase alphanumeric with hyphens.")
    @Size(max = 100, message = "slug must be at most 100 characters.")
    private String slug;

    @Size(max = 255, message = "name must be at most 255 characters.")
    private String name;

    @Size(max = 5000, message = "description must be at most 5000 characters.")
    private String description;

    private String parentId;

    private Boolean visible;

    private Boolean showOnHomepage;

    private Integer sortOrder;

    @Valid
    private ImageAssetRequest image;

    @Valid
    private ImageAssetRequest icon;

    @Valid
    private SeoMetaRequest seo;
}
