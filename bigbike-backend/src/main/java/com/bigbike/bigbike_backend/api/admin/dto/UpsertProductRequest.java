package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class UpsertProductRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Size(max = 100, message = "SKU is too long.")
    private String sku;

    @Pattern(regexp = SLUG_REGEX, message = "Slug format is invalid.")
    private String slug;

    @Size(max = 255, message = "Name is too long.")
    private String name;

    @Size(max = 2000, message = "Short description is too long.")
    private String shortDescription;

    @Size(max = 20000, message = "Description is too long.")
    private String description;

    @Size(max = 64, message = "Brand ID is too long.")
    private String brandId;

    @Size(max = 64, message = "Category ID is too long.")
    private String categoryId;

    @Valid
    private ImageAssetRequest image;

    private Integer retailPrice;
    private Integer compareAtPrice;
    private Integer salePrice;

    @Pattern(regexp = "^(VND)$", message = "Currency must be VND.")
    private String currency;

    private ProductStockState stockState;
    private PublishStatus publishStatus;

    private Boolean isFeatured;
    private Boolean showOnHomepage;

    @Valid
    private SeoMetaRequest seo;

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
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

    public String getShortDescription() {
        return shortDescription;
    }

    public void setShortDescription(String shortDescription) {
        this.shortDescription = shortDescription;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getBrandId() {
        return brandId;
    }

    public void setBrandId(String brandId) {
        this.brandId = brandId;
    }

    public String getCategoryId() {
        return categoryId;
    }

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
    }

    public ImageAssetRequest getImage() {
        return image;
    }

    public void setImage(ImageAssetRequest image) {
        this.image = image;
    }

    public Integer getRetailPrice() {
        return retailPrice;
    }

    public void setRetailPrice(Integer retailPrice) {
        this.retailPrice = retailPrice;
    }

    public Integer getCompareAtPrice() {
        return compareAtPrice;
    }

    public void setCompareAtPrice(Integer compareAtPrice) {
        this.compareAtPrice = compareAtPrice;
    }

    public Integer getSalePrice() {
        return salePrice;
    }

    public void setSalePrice(Integer salePrice) {
        this.salePrice = salePrice;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public ProductStockState getStockState() {
        return stockState;
    }

    public void setStockState(ProductStockState stockState) {
        this.stockState = stockState;
    }

    public PublishStatus getPublishStatus() {
        return publishStatus;
    }

    public void setPublishStatus(PublishStatus publishStatus) {
        this.publishStatus = publishStatus;
    }

    public Boolean getFeatured() {
        return isFeatured;
    }

    public void setFeatured(Boolean featured) {
        isFeatured = featured;
    }

    public Boolean getShowOnHomepage() {
        return showOnHomepage;
    }

    public void setShowOnHomepage(Boolean showOnHomepage) {
        this.showOnHomepage = showOnHomepage;
    }

    public SeoMetaRequest getSeo() {
        return seo;
    }

    public void setSeo(SeoMetaRequest seo) {
        this.seo = seo;
    }
}

