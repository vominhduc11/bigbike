package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

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
    private SeoMetaRequest seo;

    private Boolean visible;

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public ImageAssetRequest getLogo() {
        return logo;
    }

    public void setLogo(ImageAssetRequest logo) {
        this.logo = logo;
    }

    public SeoMetaRequest getSeo() {
        return seo;
    }

    public void setSeo(SeoMetaRequest seo) {
        this.seo = seo;
    }

    public Boolean getVisible() {
        return visible;
    }

    public void setVisible(Boolean visible) {
        this.visible = visible;
    }
}

