package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import lombok.Getter;
import lombok.Setter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
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

    // warranty_months / warranty_scope / pdp_shipping_line / pdp_return_line (V175/V247)
    // gỡ khỏi DTO ở V249 — nội dung này giờ là các dòng per-product trong khối
    // "Mua tại BigBike.vn" (purchaseLines).

    @Size(max = 120, message = "Origin brand country is too long.")
    private String originBrandCountry;
    private boolean originBrandCountryPresent = false;

    @Size(max = 20000, message = "Size guide is too long.")
    private String sizeGuide;
    private boolean sizeGuidePresent = false;

    // "Hiển thị trên web" (V245) — opaque JSON string {sectionKey: boolean}. Admin serialize, backend lưu
    // nguyên (như size_guide). Presence-flag: bỏ key → giữ nguyên; gửi null/blank → xoá cấu hình (về legacy).
    @Size(max = 4000, message = "Section visibility is too long.")
    private String sectionVisibility;
    private boolean sectionVisibilityPresent = false;

    // "Phù hợp với ai" — JSON array các thẻ [{audience, advice, linkLabel?, linkUrl?}] (V240).
    // Admin serialize JSON; backend lưu opaque (như size_guide). Giới hạn độ dài tổng chuỗi JSON.
    @Size(max = 20000, message = "Suitability advisory is too long.")
    private String suitabilityAdvisory;
    private boolean suitabilityAdvisoryPresent = false;

    // "Dán mã HTML" cho khối Thông số kỹ thuật (V255) — HTML thô, backend lưu opaque
    // (như size_guide); web sanitize khi render. Khi non-blank → web hiện HTML thay bảng specs.
    @Size(max = 50000, message = "Specifications HTML is too long.")
    private String specificationsHtml;
    private boolean specificationsHtmlPresent = false;

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
    @Size(max = 12, message = "Purchase lines may not have more than 12 items.")
    private List<PurchaseLineRequest> purchaseLines;

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

    public void setSku(String sku) {
        this.sku = sku;
        this.skuPresent = true;
    }

    public void setImage(ImageAssetRequest image) {
        this.image = image;
        this.imagePresent = true;
    }

    public void setRetailPrice(BigDecimal retailPrice) {
        this.retailPrice = retailPrice;
        this.retailPricePresent = true;
    }

    public void setCompareAtPrice(BigDecimal compareAtPrice) {
        this.compareAtPrice = compareAtPrice;
        this.compareAtPricePresent = true;
    }

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
        this.salePricePresent = true;
    }

    public void setCostPrice(BigDecimal costPrice) {
        this.costPrice = costPrice;
        this.costPricePresent = true;
    }

    public void setHomepageOrder(Integer homepageOrder) {
        this.homepageOrder = homepageOrder;
        this.homepageOrderPresent = true;
    }

    public void setPromotionContent(String promotionContent) {
        this.promotionContent = promotionContent;
        this.promotionContentPresent = true;
    }

    public void setInstallationGuide(String installationGuide) {
        this.installationGuide = installationGuide;
        this.installationGuidePresent = true;
    }

    public void setOriginBrandCountry(String originBrandCountry) {
        this.originBrandCountry = originBrandCountry;
        this.originBrandCountryPresent = true;
    }

    public void setSizeGuide(String sizeGuide) {
        this.sizeGuide = sizeGuide;
        this.sizeGuidePresent = true;
    }

    public void setSectionVisibility(String sectionVisibility) {
        this.sectionVisibility = sectionVisibility;
        this.sectionVisibilityPresent = true;
    }

    public void setSuitabilityAdvisory(String suitabilityAdvisory) {
        this.suitabilityAdvisory = suitabilityAdvisory;
        this.suitabilityAdvisoryPresent = true;
    }

    public void setSpecificationsHtml(String specificationsHtml) {
        this.specificationsHtml = specificationsHtml;
        this.specificationsHtmlPresent = true;
    }

    public void setGender(String gender) {
        this.gender = gender;
        this.genderPresent = true;
    }

    public void setSeo(SeoMetaRequest seo) {
        this.seo = seo;
        this.seoPresent = true;
    }

    public void setTranslations(ProductTranslationRequest translations) {
        this.translations = translations;
        this.translationsPresent = true;
    }

    public void setDescriptionBlocks(List<DescriptionBlock> descriptionBlocks) {
        this.descriptionBlocks = descriptionBlocks;
        this.descriptionBlocksPresent = true;
    }

    public void setDescriptionBlocksEn(List<DescriptionBlock> descriptionBlocksEn) {
        this.descriptionBlocksEn = descriptionBlocksEn;
        this.descriptionBlocksEnPresent = true;
    }

    public void setTabs(List<ProductTabRequest> tabs) {
        this.tabs = tabs;
        this.tabsPresent = true;
    }
}

