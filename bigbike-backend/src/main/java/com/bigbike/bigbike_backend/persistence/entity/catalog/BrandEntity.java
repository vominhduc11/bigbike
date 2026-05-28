package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "brands")
public class BrandEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    private String logoId;

    @Column(columnDefinition = "text")
    private String logoUrl;

    private String logoAlt;
    private Integer logoWidth;
    private Integer logoHeight;
    private String logoMimeType;

    @Column(columnDefinition = "text")
    private String bannerUrl;

    private String bannerAlt;

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

    private String nameEn;

    @Column(columnDefinition = "text")
    private String descriptionEn;

    private String seoTitleEn;

    @Column(columnDefinition = "text")
    private String seoDescriptionEn;

    @Column(nullable = false)
    private boolean isVisible;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

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

    public String getLogoId() {
        return logoId;
    }

    public void setLogoId(String logoId) {
        this.logoId = logoId;
    }

    public String getLogoUrl() {
        return logoUrl;
    }

    public void setLogoUrl(String logoUrl) {
        this.logoUrl = logoUrl;
    }

    public String getLogoAlt() {
        return logoAlt;
    }

    public void setLogoAlt(String logoAlt) {
        this.logoAlt = logoAlt;
    }

    public Integer getLogoWidth() {
        return logoWidth;
    }

    public void setLogoWidth(Integer logoWidth) {
        this.logoWidth = logoWidth;
    }

    public Integer getLogoHeight() {
        return logoHeight;
    }

    public void setLogoHeight(Integer logoHeight) {
        this.logoHeight = logoHeight;
    }

    public String getLogoMimeType() {
        return logoMimeType;
    }

    public void setLogoMimeType(String logoMimeType) {
        this.logoMimeType = logoMimeType;
    }

    public String getBannerUrl() {
        return bannerUrl;
    }

    public void setBannerUrl(String bannerUrl) {
        this.bannerUrl = bannerUrl;
    }

    public String getBannerAlt() {
        return bannerAlt;
    }

    public void setBannerAlt(String bannerAlt) {
        this.bannerAlt = bannerAlt;
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

    public String getNameEn() {
        return nameEn;
    }

    public void setNameEn(String nameEn) {
        this.nameEn = nameEn;
    }

    public String getDescriptionEn() {
        return descriptionEn;
    }

    public void setDescriptionEn(String descriptionEn) {
        this.descriptionEn = descriptionEn;
    }

    public String getSeoTitleEn() {
        return seoTitleEn;
    }

    public void setSeoTitleEn(String seoTitleEn) {
        this.seoTitleEn = seoTitleEn;
    }

    public String getSeoDescriptionEn() {
        return seoDescriptionEn;
    }

    public void setSeoDescriptionEn(String seoDescriptionEn) {
        this.seoDescriptionEn = seoDescriptionEn;
    }

    public boolean isVisible() {
        return isVisible;
    }

    public void setVisible(boolean visible) {
        isVisible = visible;
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
}
