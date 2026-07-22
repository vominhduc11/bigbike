package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
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

    /** Deprecated singleton alias, retained for the transition release only. */
    @Deprecated
    @Size(max = 64, message = "Category ID is too long.")
    private String categoryId;
    private boolean categoryIdPresent = false;

    /** Ordered category ids; the first id is the primary category. */
    @Size(max = 100, message = "A product may not have more than 100 categories.")
    private List<@Size(max = 64, message = "Category ID is too long.") String> categoryIds;
    private boolean categoryIdsPresent = false;

    @Valid
    private ImageAssetRequest image;
    private boolean imagePresent = false;

    private BigDecimal retailPrice;
    private boolean retailPricePresent = false;
    private BigDecimal salePrice;
    private boolean salePricePresent = false;

    @Pattern(regexp = "^(VND)$", message = "Currency must be VND.")
    private String currency;

    // stockState is derived from boolean availability. Removed from input — backend ignores it.
    private PublishStatus publishStatus;

    /** Product-level "còn/hết" toggle for products WITHOUT variants; ignored when variants exist. */
    private Boolean available;
    private HomepageBlock homepageBlock;
    private Integer homepageOrder;
    private boolean homepageOrderPresent;

    // rating and ratingCount are read-only — owned by the review moderation subsystem.
    // They are intentionally absent from this request DTO. Sending them in JSON is ignored
    // because Jackson will find no matching setter. Phase 2D handles rating recomputation.

    // pdp_shipping_line / pdp_return_line (V247) gỡ khỏi DTO ở V249; warranty_months /
    // warranty_scope (V175) gỡ hẳn ở V266 cùng module bảo hành. Khối "Mua tại BigBike.vn"
    // từng có field purchaseLines (V249) cũng đã gỡ hẳn ở V276 — khối giờ thuần tự động trên web.

    @Size(max = 120, message = "Origin brand country is too long.")
    private String originBrandCountry;
    private boolean originBrandCountryPresent = false;

    @Size(max = 20000, message = "Size guide is too long.")
    private String sizeGuide;
    private boolean sizeGuidePresent = false;

    // "Phù hợp với ai" — JSON array các thẻ [{audience, advice, linkLabel?, linkUrl?}] (V240).
    // Admin serialize JSON; backend lưu opaque (như size_guide). Giới hạn độ dài tổng chuỗi JSON.
    @Size(max = 20000, message = "Suitability advisory is too long.")
    private String suitabilityAdvisory;
    private boolean suitabilityAdvisoryPresent = false;

    // "Dán mã HTML" cho khối Thông số kỹ thuật (V255) — HTML thô, backend lưu opaque
    // (như size_guide); web sanitize khi render. Khi non-blank → web hiện HTML thay bảng specs.
    @Size(max = 50000, message = "Specifications HTML is too long.")
    private String specifications;
    private boolean specificationsPresent = false;

    // "Dán mã HTML" cho khối "Ô số liệu nổi bật" (specStats, V256) — HTML thô, opaque như trên.
    @Size(max = 50000, message = "Spec stats HTML is too long.")
    private String specStats;
    private boolean specStatsPresent = false;

    // "Dán mã HTML" cho khối "Dải tin cậy" (trustBadges, V257) — HTML thô, opaque như trên.
    @Size(max = 50000, message = "Trust badges HTML is too long.")
    private String trustBadges;
    private boolean trustBadgesPresent = false;

    // "Quick Answer" (trả lời nhanh, V300) — đoạn tóm tắt AIO 40-60 từ, blockquote ngay sau
    // Specs Dashboard, trước "Tính năng chi tiết". Presence-flag như suitabilityAdvisory.
    @Size(max = 600, message = "Quick answer is too long.")
    private String quickAnswerSummary;
    private boolean quickAnswerSummaryPresent = false;

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
    @Size(max = 50, message = "FAQs may not have more than 50 items.")
    private List<FaqRequest> faqs;

    @Valid
    @Size(max = 12, message = "Commitments may not have more than 12 items.")
    private List<CommitmentRequest> commitments;

    @Valid
    private HighlightsRequest highlights;

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
     * Structured description blocks (V139). Each block carries both languages inline in its own
     * {@code *En} sibling fields (V326 merge) — there is no separate English array anymore.
     * Presence-flag pattern: sending this key (including []) triggers rendering and overwrites
     * {@code description}/{@code description_en}. Omitting the key leaves both untouched.
     */
    @Valid
    @Size(max = 200, message = "descriptionBlocks may not have more than 200 items.")
    private List<DescriptionBlock> descriptionBlocks;
    private boolean descriptionBlocksPresent = false;

    /** "Phù hợp với ai" (V240, tách khỏi descriptionBlocks ở V327/V328). Presence-flag: {@code null} clears it. */
    @Valid
    private SuitabilitySection suitabilitySection;
    private boolean suitabilitySectionPresent = false;

    /** "Bảng size" (V246, tách khỏi descriptionBlocks ở V327/V328). Presence-flag: {@code null} clears it. */
    @Valid
    private SizeGuideSection sizeGuideSection;
    private boolean sizeGuideSectionPresent = false;

    public void setCategoryId(String categoryId) {
        this.categoryId = categoryId;
        this.categoryIdPresent = true;
    }

    public void setCategoryIds(List<String> categoryIds) {
        this.categoryIds = categoryIds;
        this.categoryIdsPresent = true;
    }

    /** Used by JSON import after resolving slugs to the normal internal-id contract. */
    public void useResolvedCategoryIds(List<String> categoryIds) {
        this.categoryIds = categoryIds;
        this.categoryIdsPresent = true;
        this.categoryId = null;
        this.categoryIdPresent = false;
    }

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

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
        this.salePricePresent = true;
    }

    public void setHomepageOrder(Integer homepageOrder) {
        this.homepageOrder = homepageOrder;
        this.homepageOrderPresent = true;
    }

    public void setOriginBrandCountry(String originBrandCountry) {
        this.originBrandCountry = originBrandCountry;
        this.originBrandCountryPresent = true;
    }

    public void setSizeGuide(String sizeGuide) {
        this.sizeGuide = sizeGuide;
        this.sizeGuidePresent = true;
    }

    public void setSuitabilityAdvisory(String suitabilityAdvisory) {
        this.suitabilityAdvisory = suitabilityAdvisory;
        this.suitabilityAdvisoryPresent = true;
    }

    public void setSpecifications(String specifications) {
        this.specifications = specifications;
        this.specificationsPresent = true;
    }

    public void setSpecStats(String specStats) {
        this.specStats = specStats;
        this.specStatsPresent = true;
    }

    public void setTrustBadges(String trustBadges) {
        this.trustBadges = trustBadges;
        this.trustBadgesPresent = true;
    }

    public void setQuickAnswerSummary(String quickAnswerSummary) {
        this.quickAnswerSummary = quickAnswerSummary;
        this.quickAnswerSummaryPresent = true;
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

    public void setSuitabilitySection(SuitabilitySection suitabilitySection) {
        this.suitabilitySection = suitabilitySection;
        this.suitabilitySectionPresent = true;
    }

    public void setSizeGuideSection(SizeGuideSection sizeGuideSection) {
        this.sizeGuideSection = sizeGuideSection;
        this.sizeGuideSectionPresent = true;
    }

}

