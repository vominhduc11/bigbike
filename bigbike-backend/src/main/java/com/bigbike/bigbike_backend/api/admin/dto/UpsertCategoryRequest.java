package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UpsertCategoryRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Pattern(regexp = SLUG_REGEX, message = "Slug format is invalid.")
    private String slug;

    @Size(max = 255, message = "Name is too long.")
    private String name;

    @Size(max = 5000, message = "Description is too long.")
    private String description;

    @Size(max = 64, message = "Parent ID is too long.")
    private String parentId;

    @Valid
    private ImageAssetRequest image;

    @Valid
    private ImageAssetRequest icon;

    @Valid
    private SeoMetaRequest seo;

    private Boolean visible;
    private Integer sortOrder;

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

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
    }

    public ImageAssetRequest getImage() {
        return image;
    }

    public void setImage(ImageAssetRequest image) {
        this.image = image;
    }

    public ImageAssetRequest getIcon() {
        return icon;
    }

    public void setIcon(ImageAssetRequest icon) {
        this.icon = icon;
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

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }
}

