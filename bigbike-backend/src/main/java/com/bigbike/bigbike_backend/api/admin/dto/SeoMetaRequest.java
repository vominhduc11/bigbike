package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCanonicalUrl() {
        return canonicalUrl;
    }

    public void setCanonicalUrl(String canonicalUrl) {
        this.canonicalUrl = canonicalUrl;
    }

    public ImageAssetRequest getOgImage() {
        return ogImage;
    }

    public void setOgImage(ImageAssetRequest ogImage) {
        this.ogImage = ogImage;
    }

    public Boolean getNoIndex() {
        return noIndex;
    }

    public void setNoIndex(Boolean noIndex) {
        this.noIndex = noIndex;
    }
}

