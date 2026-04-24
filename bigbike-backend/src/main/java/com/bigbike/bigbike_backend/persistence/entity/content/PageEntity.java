package com.bigbike.bigbike_backend.persistence.entity.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.PageType;
import jakarta.persistence.Column;
import jakarta.persistence.FetchType;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "pages")
public class PageEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private PageEntity parent;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PageType pageType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PublishStatus publishStatus;

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

    private Instant publishedAt;

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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public PageEntity getParent() {
        return parent;
    }

    public void setParent(PageEntity parent) {
        this.parent = parent;
    }

    public PageType getPageType() {
        return pageType;
    }

    public void setPageType(PageType pageType) {
        this.pageType = pageType;
    }

    public PublishStatus getPublishStatus() {
        return publishStatus;
    }

    public void setPublishStatus(PublishStatus publishStatus) {
        this.publishStatus = publishStatus;
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

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
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
