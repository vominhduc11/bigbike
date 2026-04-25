package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "categories")
public class CategoryEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private CategoryEntity parent;

    private String imageId;

    @Column(columnDefinition = "text")
    private String imageUrl;

    private String imageAlt;
    private Integer imageWidth;
    private Integer imageHeight;
    private String imageMimeType;

    private String iconId;

    @Column(columnDefinition = "text")
    private String iconUrl;

    private String iconAlt;
    private Integer iconWidth;
    private Integer iconHeight;
    private String iconMimeType;

    private String seoTitle;

    @Column(columnDefinition = "text")
    private String seoDescription;

    @Column(columnDefinition = "text")
    private String seoCanonicalUrl;

    private String seoOgImageId;

    @Column(columnDefinition = "text")
    private String seoOgImageUrl;

    private String seoOgImageAlt;
    private Integer seoOgImageWidth;
    private Integer seoOgImageHeight;
    private String seoOgImageMimeType;
    private Boolean seoNoIndex;

    @Column(nullable = false)
    private boolean isVisible;

    private Boolean showOnHomepage;
    private Integer sortOrder;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "parent", fetch = FetchType.LAZY)
    private List<CategoryEntity> children = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

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
        return parent == null ? null : parent.getId();
    }

    public CategoryEntity getParent() {
        return parent;
    }

    public void setParent(CategoryEntity parent) {
        this.parent = parent;
    }

    public String getImageId() {
        return imageId;
    }

    public void setImageId(String imageId) {
        this.imageId = imageId;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getImageAlt() {
        return imageAlt;
    }

    public void setImageAlt(String imageAlt) {
        this.imageAlt = imageAlt;
    }

    public Integer getImageWidth() {
        return imageWidth;
    }

    public void setImageWidth(Integer imageWidth) {
        this.imageWidth = imageWidth;
    }

    public Integer getImageHeight() {
        return imageHeight;
    }

    public void setImageHeight(Integer imageHeight) {
        this.imageHeight = imageHeight;
    }

    public String getImageMimeType() {
        return imageMimeType;
    }

    public void setImageMimeType(String imageMimeType) {
        this.imageMimeType = imageMimeType;
    }

    public String getIconId() {
        return iconId;
    }

    public void setIconId(String iconId) {
        this.iconId = iconId;
    }

    public String getIconUrl() {
        return iconUrl;
    }

    public void setIconUrl(String iconUrl) {
        this.iconUrl = iconUrl;
    }

    public String getIconAlt() {
        return iconAlt;
    }

    public void setIconAlt(String iconAlt) {
        this.iconAlt = iconAlt;
    }

    public Integer getIconWidth() {
        return iconWidth;
    }

    public void setIconWidth(Integer iconWidth) {
        this.iconWidth = iconWidth;
    }

    public Integer getIconHeight() {
        return iconHeight;
    }

    public void setIconHeight(Integer iconHeight) {
        this.iconHeight = iconHeight;
    }

    public String getIconMimeType() {
        return iconMimeType;
    }

    public void setIconMimeType(String iconMimeType) {
        this.iconMimeType = iconMimeType;
    }

    public String getSeoTitle() {
        return seoTitle;
    }

    public void setSeoTitle(String seoTitle) {
        this.seoTitle = seoTitle;
    }

    public String getSeoDescription() {
        return seoDescription;
    }

    public void setSeoDescription(String seoDescription) {
        this.seoDescription = seoDescription;
    }

    public String getSeoCanonicalUrl() {
        return seoCanonicalUrl;
    }

    public void setSeoCanonicalUrl(String seoCanonicalUrl) {
        this.seoCanonicalUrl = seoCanonicalUrl;
    }

    public String getSeoOgImageId() {
        return seoOgImageId;
    }

    public void setSeoOgImageId(String seoOgImageId) {
        this.seoOgImageId = seoOgImageId;
    }

    public String getSeoOgImageUrl() {
        return seoOgImageUrl;
    }

    public void setSeoOgImageUrl(String seoOgImageUrl) {
        this.seoOgImageUrl = seoOgImageUrl;
    }

    public String getSeoOgImageAlt() {
        return seoOgImageAlt;
    }

    public void setSeoOgImageAlt(String seoOgImageAlt) {
        this.seoOgImageAlt = seoOgImageAlt;
    }

    public Integer getSeoOgImageWidth() {
        return seoOgImageWidth;
    }

    public void setSeoOgImageWidth(Integer seoOgImageWidth) {
        this.seoOgImageWidth = seoOgImageWidth;
    }

    public Integer getSeoOgImageHeight() {
        return seoOgImageHeight;
    }

    public void setSeoOgImageHeight(Integer seoOgImageHeight) {
        this.seoOgImageHeight = seoOgImageHeight;
    }

    public String getSeoOgImageMimeType() {
        return seoOgImageMimeType;
    }

    public void setSeoOgImageMimeType(String seoOgImageMimeType) {
        this.seoOgImageMimeType = seoOgImageMimeType;
    }

    public Boolean getSeoNoIndex() {
        return seoNoIndex;
    }

    public void setSeoNoIndex(Boolean seoNoIndex) {
        this.seoNoIndex = seoNoIndex;
    }

    public boolean isVisible() {
        return isVisible;
    }

    public void setVisible(boolean visible) {
        isVisible = visible;
    }

    public Boolean getShowOnHomepage() {
        return showOnHomepage;
    }

    public void setShowOnHomepage(Boolean showOnHomepage) {
        this.showOnHomepage = showOnHomepage;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<CategoryEntity> getChildren() {
        return children;
    }

    public void setChildren(List<CategoryEntity> children) {
        this.children = children;
    }
}
