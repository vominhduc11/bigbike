package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

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

    public String getSlug() { return slug; }
    public void setSlug(String slug) { this.slug = slug; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getParentId() { return parentId; }
    public void setParentId(String parentId) { this.parentId = parentId; }

    public Boolean getVisible() { return visible; }
    public void setVisible(Boolean visible) { this.visible = visible; }

    public Boolean getShowOnHomepage() { return showOnHomepage; }
    public void setShowOnHomepage(Boolean showOnHomepage) { this.showOnHomepage = showOnHomepage; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public ImageAssetRequest getImage() { return image; }
    public void setImage(ImageAssetRequest image) { this.image = image; }

    public ImageAssetRequest getIcon() { return icon; }
    public void setIcon(ImageAssetRequest icon) { this.icon = icon; }

    public SeoMetaRequest getSeo() { return seo; }
    public void setSeo(SeoMetaRequest seo) { this.seo = seo; }
}
