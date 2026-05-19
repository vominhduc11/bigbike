package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public class UpsertProductRequest {

    private static final String SLUG_REGEX = "^[a-z0-9]+(?:-[a-z0-9]+)*$";

    @Size(max = 100, message = "SKU is too long.")
    private String sku;
    private boolean skuPresent = false;

    @Size(max = 200, message = "Slug is too long.")
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
    private boolean imagePresent = false;

    private BigDecimal retailPrice;
    private boolean retailPricePresent = false;
    private BigDecimal compareAtPrice;
    private boolean compareAtPricePresent = false;
    private BigDecimal salePrice;
    private boolean salePricePresent = false;

    @Pattern(regexp = "^(VND)$", message = "Currency must be VND.")
    private String currency;

    // stockState is a derived field (computed from quantityOnHand). Removed from input — backend ignores it.
    private PublishStatus publishStatus;

    private Boolean forceOutOfStock;
    private HomepageBlock homepageBlock;
    private Integer homepageOrder;
    private boolean homepageOrderPresent;

    // rating and ratingCount are read-only — owned by the review moderation subsystem.
    // They are intentionally absent from this request DTO. Sending them in JSON is ignored
    // because Jackson will find no matching setter. Phase 2D handles rating recomputation.

    @Size(max = 50000, message = "Content bottom is too long.")
    private String contentBottom;
    private boolean contentBottomPresent = false;

    @Size(max = 50000, message = "Promotion content is too long.")
    private String promotionContent;
    private boolean promotionContentPresent = false;

    @Size(max = 50000, message = "Installation guide is too long.")
    private String installationGuide;
    private boolean installationGuidePresent = false;

    @Valid
    private SeoMetaRequest seo;
    private boolean seoPresent = false;

    @Valid
    @Size(max = 50, message = "Gallery may not have more than 50 images.")
    private List<GalleryImageRequest> gallery;

    @Valid
    @Size(max = 20, message = "Videos may not have more than 20 items.")
    private List<VideoRequest> videos;

    @Valid
    @Size(max = 100, message = "Specifications may not have more than 100 items.")
    private List<SpecificationRequest> specifications;

    @Valid
    @Size(max = 50, message = "FAQs may not have more than 50 items.")
    private List<FaqRequest> faqs;

    @Valid
    @Size(max = 200, message = "Variants may not have more than 200 items.")
    private List<VariantRequest> variants;

    /**
     * Admin-curated related product IDs for the PDP "Sản phẩm liên quan" section.
     * Ordered; null = leave unchanged, empty list = clear all. Unknown IDs and the
     * product's own ID are dropped silently by the mutation service.
     */
    @Size(max = 24, message = "Related products may not have more than 24 items.")
    private List<String> relatedProductIds;

    public String getSku() {
        return sku;
    }

    public void setSku(String sku) {
        this.sku = sku;
        this.skuPresent = true;
    }

    public boolean isSkuPresent() {
        return skuPresent;
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
        this.imagePresent = true;
    }

    public boolean isImagePresent() {
        return imagePresent;
    }

    public BigDecimal getRetailPrice() {
        return retailPrice;
    }

    public void setRetailPrice(BigDecimal retailPrice) {
        this.retailPrice = retailPrice;
        this.retailPricePresent = true;
    }

    public boolean isRetailPricePresent() {
        return retailPricePresent;
    }

    public BigDecimal getCompareAtPrice() {
        return compareAtPrice;
    }

    public void setCompareAtPrice(BigDecimal compareAtPrice) {
        this.compareAtPrice = compareAtPrice;
        this.compareAtPricePresent = true;
    }

    public boolean isCompareAtPricePresent() {
        return compareAtPricePresent;
    }

    public BigDecimal getSalePrice() {
        return salePrice;
    }

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
        this.salePricePresent = true;
    }

    public boolean isSalePricePresent() {
        return salePricePresent;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public PublishStatus getPublishStatus() {
        return publishStatus;
    }

    public void setPublishStatus(PublishStatus publishStatus) {
        this.publishStatus = publishStatus;
    }

    public Boolean getForceOutOfStock() {
        return forceOutOfStock;
    }

    public void setForceOutOfStock(Boolean forceOutOfStock) {
        this.forceOutOfStock = forceOutOfStock;
    }

    public HomepageBlock getHomepageBlock() {
        return homepageBlock;
    }

    public void setHomepageBlock(HomepageBlock homepageBlock) {
        this.homepageBlock = homepageBlock;
    }

    public Integer getHomepageOrder() {
        return homepageOrder;
    }

    public void setHomepageOrder(Integer homepageOrder) {
        this.homepageOrder = homepageOrder;
        this.homepageOrderPresent = true;
    }

    public boolean isHomepageOrderPresent() {
        return homepageOrderPresent;
    }

    public String getContentBottom() {
        return contentBottom;
    }

    public void setContentBottom(String contentBottom) {
        this.contentBottom = contentBottom;
        this.contentBottomPresent = true;
    }

    public boolean isContentBottomPresent() {
        return contentBottomPresent;
    }

    public String getPromotionContent() {
        return promotionContent;
    }

    public void setPromotionContent(String promotionContent) {
        this.promotionContent = promotionContent;
        this.promotionContentPresent = true;
    }

    public boolean isPromotionContentPresent() {
        return promotionContentPresent;
    }

    public String getInstallationGuide() {
        return installationGuide;
    }

    public void setInstallationGuide(String installationGuide) {
        this.installationGuide = installationGuide;
        this.installationGuidePresent = true;
    }

    public boolean isInstallationGuidePresent() {
        return installationGuidePresent;
    }

    public SeoMetaRequest getSeo() {
        return seo;
    }

    public void setSeo(SeoMetaRequest seo) {
        this.seo = seo;
        this.seoPresent = true;
    }

    public boolean isSeoPresent() {
        return seoPresent;
    }

    public List<GalleryImageRequest> getGallery() { return gallery; }
    public void setGallery(List<GalleryImageRequest> gallery) { this.gallery = gallery; }

    public List<VideoRequest> getVideos() { return videos; }
    public void setVideos(List<VideoRequest> videos) { this.videos = videos; }

    public List<SpecificationRequest> getSpecifications() { return specifications; }
    public void setSpecifications(List<SpecificationRequest> specifications) { this.specifications = specifications; }

    public List<FaqRequest> getFaqs() { return faqs; }
    public void setFaqs(List<FaqRequest> faqs) { this.faqs = faqs; }

    public List<VariantRequest> getVariants() { return variants; }
    public void setVariants(List<VariantRequest> variants) { this.variants = variants; }

    public List<String> getRelatedProductIds() { return relatedProductIds; }
    public void setRelatedProductIds(List<String> relatedProductIds) { this.relatedProductIds = relatedProductIds; }
}

