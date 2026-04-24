package com.bigbike.bigbike_backend.persistence.entity.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "articles")
public class ArticleEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String excerpt;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    private String coverImageId;

    @Column(columnDefinition = "text")
    private String coverImageUrl;

    private String coverImageAlt;
    private Integer coverImageWidth;
    private Integer coverImageHeight;
    private String coverImageMimeType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id")
    private ContentAuthorEntity author;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private ContentCategoryEntity category;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "article_category_map",
            joinColumns = @JoinColumn(name = "article_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    @OrderColumn(name = "sort_order")
    private List<ContentCategoryEntity> categories = new ArrayList<>();

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "article_tag_map",
            joinColumns = @JoinColumn(name = "article_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    @OrderColumn(name = "sort_order")
    private List<BlogTagEntity> tags = new ArrayList<>();

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

    public String getExcerpt() {
        return excerpt;
    }

    public void setExcerpt(String excerpt) {
        this.excerpt = excerpt;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String body) {
        this.body = body;
    }

    public String getCoverImageId() {
        return coverImageId;
    }

    public void setCoverImageId(String coverImageId) {
        this.coverImageId = coverImageId;
    }

    public String getCoverImageUrl() {
        return coverImageUrl;
    }

    public void setCoverImageUrl(String coverImageUrl) {
        this.coverImageUrl = coverImageUrl;
    }

    public String getCoverImageAlt() {
        return coverImageAlt;
    }

    public void setCoverImageAlt(String coverImageAlt) {
        this.coverImageAlt = coverImageAlt;
    }

    public Integer getCoverImageWidth() {
        return coverImageWidth;
    }

    public void setCoverImageWidth(Integer coverImageWidth) {
        this.coverImageWidth = coverImageWidth;
    }

    public Integer getCoverImageHeight() {
        return coverImageHeight;
    }

    public void setCoverImageHeight(Integer coverImageHeight) {
        this.coverImageHeight = coverImageHeight;
    }

    public String getCoverImageMimeType() {
        return coverImageMimeType;
    }

    public void setCoverImageMimeType(String coverImageMimeType) {
        this.coverImageMimeType = coverImageMimeType;
    }

    public ContentAuthorEntity getAuthor() {
        return author;
    }

    public void setAuthor(ContentAuthorEntity author) {
        this.author = author;
    }

    public ContentCategoryEntity getCategory() {
        return category;
    }

    public void setCategory(ContentCategoryEntity category) {
        this.category = category;
    }

    public List<ContentCategoryEntity> getCategories() {
        return categories;
    }

    public void setCategories(List<ContentCategoryEntity> categories) {
        this.categories = categories;
    }

    public List<BlogTagEntity> getTags() {
        return tags;
    }

    public void setTags(List<BlogTagEntity> tags) {
        this.tags = tags;
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
