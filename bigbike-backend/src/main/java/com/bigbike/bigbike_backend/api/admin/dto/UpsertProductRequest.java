package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
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
    private BigDecimal costPrice;
    private boolean costPricePresent = false;

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

    @Size(max = 50000, message = "Promotion content is too long.")
    private String promotionContent;
    private boolean promotionContentPresent = false;

    @Size(max = 50000, message = "Installation guide is too long.")
    private String installationGuide;
    private boolean installationGuidePresent = false;

    // Template SEO fields (V175). Presence-flag pattern: omitting the key on PATCH
    // leaves the column untouched; sending null/blank clears it. 1 ngôn ngữ.
    private Integer warrantyMonths;
    private boolean warrantyMonthsPresent = false;

    @Size(max = 2000, message = "Warranty scope is too long.")
    private String warrantyScope;
    private boolean warrantyScopePresent = false;

    @Size(max = 120, message = "Origin brand country is too long.")
    private String originBrandCountry;
    private boolean originBrandCountryPresent = false;

    /** Trọng lượng tính bằng gram. Lưu vào cột weight_kg (= grams / 1000). */
    private Integer weightGrams;
    private boolean weightGramsPresent = false;

    @Size(max = 20000, message = "Size guide is too long.")
    private String sizeGuide;
    private boolean sizeGuidePresent = false;

    // "Hiển thị trên web" (V245) — opaque JSON string {sectionKey: boolean}. Admin serialize, backend lưu
    // nguyên (như size_guide). Presence-flag: bỏ key → giữ nguyên; gửi null/blank → xoá cấu hình (về legacy).
    @Size(max = 4000, message = "Section visibility is too long.")
    private String sectionVisibility;
    private boolean sectionVisibilityPresent = false;

    @Size(max = 600, message = "Quick answer is too long.")
    private String quickAnswerSummary;
    private boolean quickAnswerSummaryPresent = false;

    // "Phù hợp với ai" — JSON array các thẻ [{audience, advice, linkLabel?, linkUrl?}] (V240).
    // Admin serialize JSON; backend lưu opaque (như size_guide). Giới hạn độ dài tổng chuỗi JSON.
    @Size(max = 20000, message = "Suitability advisory is too long.")
    private String suitabilityAdvisory;
    private boolean suitabilityAdvisoryPresent = false;

    @Size(max = 20, message = "Gender is too long.")
    private String gender;
    private boolean genderPresent = false;

    @Valid
    private SeoMetaRequest seo;
    private boolean seoPresent = false;

    /**
     * Optional English content (V136). Presence-flag pattern: omitting the
     * {@code translations} key on PATCH leaves the English columns untouched.
     */
    @Valid
    private ProductTranslationRequest translations;
    private boolean translationsPresent = false;

    @Valid
    @Size(max = 50, message = "Gallery may not have more than 50 images.")
    private List<GalleryImageRequest> gallery;

    @Valid
    @Size(max = 20, message = "Videos may not have more than 20 items.")
    private List<VideoRequest> videos;

    @Valid
    @Size(max = 100, message = "Specifications may not have more than 100 items.")
    private List<SpecificationRequest> specifications;

    /** "Specs Dashboard" stat boxes under the buy area (V235), max 4. Selling-point figures, not specs. */
    @Valid
    @Size(max = 4, message = "Spec stats may not have more than 4 items.")
    private List<SpecStatRequest> specStats;

    @Valid
    @Size(max = 50, message = "FAQs may not have more than 50 items.")
    private List<FaqRequest> faqs;

    @Valid
    @Size(max = 12, message = "Commitments may not have more than 12 items.")
    private List<CommitmentRequest> commitments;

    @Valid
    @Size(max = 12, message = "Trust badges may not have more than 12 items.")
    private List<TrustBadgeRequest> trustBadges;

    @Valid
    @Size(max = 20, message = "Pros may not have more than 20 items.")
    private List<HighlightRequest> positiveNotes;

    @Valid
    @Size(max = 20, message = "Cons may not have more than 20 items.")
    private List<HighlightRequest> negativeNotes;

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

    /**
     * Admin-curated accessory product IDs ("Phụ kiện" — sản phẩm bán kèm) for the PDP
     * "Phụ kiện" section. Ordered; null = leave unchanged, empty list = clear all.
     * Unknown IDs and the product's own ID are dropped silently by the mutation service.
     */
    @Size(max = 24, message = "Accessories may not have more than 24 items.")
    private List<String> accessoryProductIds;

    /**
     * Structured description blocks (V139). Presence-flag pattern:
     * sending this key (including []) triggers rendering and overwrites both
     * description_blocks and description. Omitting the key leaves both untouched.
     */
    @Valid
    @Size(max = 200, message = "descriptionBlocks may not have more than 200 items.")
    private List<DescriptionBlock> descriptionBlocks;
    private boolean descriptionBlocksPresent = false;

    /**
     * English structured description blocks (V229). Same presence-flag pattern as
     * {@link #descriptionBlocks}: sending this key (including []) renders the blocks and overwrites
     * both description_blocks_en and description_en. Omitting the key leaves the English columns
     * (set via {@code translations.en.description}) untouched.
     */
    @Valid
    @Size(max = 200, message = "descriptionBlocksEn may not have more than 200 items.")
    private List<DescriptionBlock> descriptionBlocksEn;
    private boolean descriptionBlocksEnPresent = false;

    /**
     * Per-product PDP tab configuration (V231). Presence-flag pattern: sending the key (including [])
     * replaces the stored config; omitting it leaves product_tabs untouched. Sending [] / null clears
     * the override so the product falls back to the default tab set.
     */
    @Valid
    @Size(max = 30, message = "tabs may not have more than 30 items.")
    private List<ProductTabRequest> tabs;
    private boolean tabsPresent = false;

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

    public BigDecimal getCostPrice() {
        return costPrice;
    }

    public void setCostPrice(BigDecimal costPrice) {
        this.costPrice = costPrice;
        this.costPricePresent = true;
    }

    public boolean isCostPricePresent() {
        return costPricePresent;
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

    public Integer getWarrantyMonths() {
        return warrantyMonths;
    }

    public void setWarrantyMonths(Integer warrantyMonths) {
        this.warrantyMonths = warrantyMonths;
        this.warrantyMonthsPresent = true;
    }

    public boolean isWarrantyMonthsPresent() {
        return warrantyMonthsPresent;
    }

    public String getWarrantyScope() {
        return warrantyScope;
    }

    public void setWarrantyScope(String warrantyScope) {
        this.warrantyScope = warrantyScope;
        this.warrantyScopePresent = true;
    }

    public boolean isWarrantyScopePresent() {
        return warrantyScopePresent;
    }

    public String getOriginBrandCountry() {
        return originBrandCountry;
    }

    public void setOriginBrandCountry(String originBrandCountry) {
        this.originBrandCountry = originBrandCountry;
        this.originBrandCountryPresent = true;
    }

    public boolean isOriginBrandCountryPresent() {
        return originBrandCountryPresent;
    }

    public Integer getWeightGrams() {
        return weightGrams;
    }

    public void setWeightGrams(Integer weightGrams) {
        this.weightGrams = weightGrams;
        this.weightGramsPresent = true;
    }

    public boolean isWeightGramsPresent() {
        return weightGramsPresent;
    }

    public String getSizeGuide() {
        return sizeGuide;
    }

    public void setSizeGuide(String sizeGuide) {
        this.sizeGuide = sizeGuide;
        this.sizeGuidePresent = true;
    }

    public boolean isSizeGuidePresent() {
        return sizeGuidePresent;
    }

    public String getSectionVisibility() {
        return sectionVisibility;
    }

    public void setSectionVisibility(String sectionVisibility) {
        this.sectionVisibility = sectionVisibility;
        this.sectionVisibilityPresent = true;
    }

    public boolean isSectionVisibilityPresent() {
        return sectionVisibilityPresent;
    }

    public String getQuickAnswerSummary() {
        return quickAnswerSummary;
    }

    public void setQuickAnswerSummary(String quickAnswerSummary) {
        this.quickAnswerSummary = quickAnswerSummary;
        this.quickAnswerSummaryPresent = true;
    }

    public boolean isQuickAnswerSummaryPresent() {
        return quickAnswerSummaryPresent;
    }

    public String getSuitabilityAdvisory() {
        return suitabilityAdvisory;
    }

    public void setSuitabilityAdvisory(String suitabilityAdvisory) {
        this.suitabilityAdvisory = suitabilityAdvisory;
        this.suitabilityAdvisoryPresent = true;
    }

    public boolean isSuitabilityAdvisoryPresent() {
        return suitabilityAdvisoryPresent;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
        this.genderPresent = true;
    }

    public boolean isGenderPresent() {
        return genderPresent;
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

    public ProductTranslationRequest getTranslations() {
        return translations;
    }

    public void setTranslations(ProductTranslationRequest translations) {
        this.translations = translations;
        this.translationsPresent = true;
    }

    public boolean isTranslationsPresent() {
        return translationsPresent;
    }

    public List<GalleryImageRequest> getGallery() { return gallery; }
    public void setGallery(List<GalleryImageRequest> gallery) { this.gallery = gallery; }

    public List<VideoRequest> getVideos() { return videos; }
    public void setVideos(List<VideoRequest> videos) { this.videos = videos; }

    public List<SpecificationRequest> getSpecifications() { return specifications; }
    public void setSpecifications(List<SpecificationRequest> specifications) { this.specifications = specifications; }

    public List<SpecStatRequest> getSpecStats() { return specStats; }
    public void setSpecStats(List<SpecStatRequest> specStats) { this.specStats = specStats; }

    public List<FaqRequest> getFaqs() { return faqs; }
    public void setFaqs(List<FaqRequest> faqs) { this.faqs = faqs; }

    public List<CommitmentRequest> getCommitments() { return commitments; }
    public void setCommitments(List<CommitmentRequest> commitments) { this.commitments = commitments; }

    public List<TrustBadgeRequest> getTrustBadges() { return trustBadges; }
    public void setTrustBadges(List<TrustBadgeRequest> trustBadges) { this.trustBadges = trustBadges; }

    public List<HighlightRequest> getPositiveNotes() { return positiveNotes; }
    public void setPositiveNotes(List<HighlightRequest> positiveNotes) { this.positiveNotes = positiveNotes; }

    public List<HighlightRequest> getNegativeNotes() { return negativeNotes; }
    public void setNegativeNotes(List<HighlightRequest> negativeNotes) { this.negativeNotes = negativeNotes; }

    public List<VariantRequest> getVariants() { return variants; }
    public void setVariants(List<VariantRequest> variants) { this.variants = variants; }

    public List<String> getRelatedProductIds() { return relatedProductIds; }
    public void setRelatedProductIds(List<String> relatedProductIds) { this.relatedProductIds = relatedProductIds; }

    public List<String> getAccessoryProductIds() { return accessoryProductIds; }
    public void setAccessoryProductIds(List<String> accessoryProductIds) { this.accessoryProductIds = accessoryProductIds; }

    public List<DescriptionBlock> getDescriptionBlocks() { return descriptionBlocks; }
    public void setDescriptionBlocks(List<DescriptionBlock> descriptionBlocks) {
        this.descriptionBlocks = descriptionBlocks;
        this.descriptionBlocksPresent = true;
    }
    public boolean isDescriptionBlocksPresent() { return descriptionBlocksPresent; }

    public List<DescriptionBlock> getDescriptionBlocksEn() { return descriptionBlocksEn; }
    public void setDescriptionBlocksEn(List<DescriptionBlock> descriptionBlocksEn) {
        this.descriptionBlocksEn = descriptionBlocksEn;
        this.descriptionBlocksEnPresent = true;
    }
    public boolean isDescriptionBlocksEnPresent() { return descriptionBlocksEnPresent; }

    public List<ProductTabRequest> getTabs() { return tabs; }
    public void setTabs(List<ProductTabRequest> tabs) {
        this.tabs = tabs;
        this.tabsPresent = true;
    }
    public boolean isTabsPresent() { return tabsPresent; }
}

