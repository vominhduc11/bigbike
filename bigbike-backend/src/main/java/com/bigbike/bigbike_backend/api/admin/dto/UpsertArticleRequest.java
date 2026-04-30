package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public class UpsertArticleRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Pattern(regexp = SLUG_REGEX, message = "Slug format is invalid.")
    private String slug;

    @Size(max = 255, message = "Title is too long.")
    private String title;

    @Size(max = 5000, message = "Excerpt is too long.")
    private String excerpt;

    private String body;

    @Valid
    private ImageAssetRequest coverImage;

    @Valid
    private ImageAssetRequest productImage;

    @Size(max = 64, message = "Author ID is too long.")
    private String authorId;

    @Size(max = 64, message = "Category ID is too long.")
    private String categoryId;

    private List<@Size(max = 120, message = "Tag is too long.") String> tags;

    private PublishStatus publishStatus;

    @Valid
    private SeoMetaRequest seo;

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

    public ImageAssetRequest getCoverImage() {
        return coverImage;
    }

    public void setCoverImage(ImageAssetRequest coverImage) {
        this.coverImage = coverImage;
    }

    public ImageAssetRequest getProductImage() {
        return productImage;
    }

    public void setProductImage(ImageAssetRequest productImage) {
        this.productImage = productImage;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public PublishStatus getPublishStatus() {
        return publishStatus;
    }

    public void setPublishStatus(PublishStatus publishStatus) {
        this.publishStatus = publishStatus;
    }

    public SeoMetaRequest getSeo() {
        return seo;
    }

    public void setSeo(SeoMetaRequest seo) {
        this.seo = seo;
    }
}

