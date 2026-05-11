package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.PageType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UpsertPageRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Pattern(regexp = SLUG_REGEX, message = "Slug format is invalid.")
    private String slug;

    @Size(max = 255, message = "Title is too long.")
    private String title;

    private String body;
    @Size(max = 64, message = "Parent ID is too long.")
    private String parentId;
    private PageType pageType;
    private PublishStatus publishStatus;

    @Valid
    private SeoMetaRequest seo;

    @Valid
    private ImageAssetRequest heroImage;

    @Size(max = 256, message = "Hero title is too long.")
    private String heroTitle;

    @Size(max = 1024, message = "Hero description is too long.")
    private String heroDescription;

    @Size(max = 128, message = "Hero kicker is too long.")
    private String heroKicker;

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

    public String getParentId() {
        return parentId;
    }

    public void setParentId(String parentId) {
        this.parentId = parentId;
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

    public SeoMetaRequest getSeo() {
        return seo;
    }

    public void setSeo(SeoMetaRequest seo) {
        this.seo = seo;
    }

    public ImageAssetRequest getHeroImage() {
        return heroImage;
    }

    public void setHeroImage(ImageAssetRequest heroImage) {
        this.heroImage = heroImage;
    }

    public String getHeroTitle() {
        return heroTitle;
    }

    public void setHeroTitle(String heroTitle) {
        this.heroTitle = heroTitle;
    }

    public String getHeroDescription() {
        return heroDescription;
    }

    public void setHeroDescription(String heroDescription) {
        this.heroDescription = heroDescription;
    }

    public String getHeroKicker() {
        return heroKicker;
    }

    public void setHeroKicker(String heroKicker) {
        this.heroKicker = heroKicker;
    }
}
