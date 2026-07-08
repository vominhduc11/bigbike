package com.bigbike.bigbike_backend.api.admin.dto;

import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.math.BigDecimal;
import java.util.List;

/**
 * Wire shape for the bulk product import/export JSON template (product-template/mau-day-du.json).
 * Every bilingual column is nested as one object at its own key (e.g. {@code name: {nameVI, nameEN}})
 * instead of a Vietnamese top-level key plus a separate {@code translations.en.*} block, so both
 * languages of a column sit next to each other in the file. {@link ProductImportRowMapper} converts
 * this shape to/from {@link UpsertProductRequest} + {@link ProductTranslationRequest} — the shape the
 * single-product admin form uses and must not change.
 */
@Getter
@Setter
@NoArgsConstructor
public class ProductImportRow {

    private String sku;
    private String categoryId;
    private String brandId;
    private String gender;

    // Owner decision 2026-07-07: retailPrice/salePrice always show in export, null-filled when the
    // product has no shared price (e.g. a variant-priced product with no product-level fallback) or
    // isn't on sale, instead of being dropped — same treatment as the bilingual VI/EN columns below.
    // ProductImportRowMapper only calls request.setRetailPrice(...)/setSalePrice(...) when the value
    // is non-null, so an explicit JSON `null` here behaves exactly like an omitted key on import
    // (both leave the existing value untouched on update) — safe either way, unlike
    // VariantRequest.salePrice below (see its own comment).
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private BigDecimal retailPrice;
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private BigDecimal salePrice;
    private String currency;
    private PublishStatus publishStatus;
    private Boolean forceOutOfStock;
    private HomepageBlock homepageBlock;
    private Integer homepageOrder;

    private NameField name;
    private SlugField slug;
    private ShortDescriptionField shortDescription;
    // HTML-only PDP blocks. Bulk import must provide HTML directly here; the legacy structured
    // fields specifications/specStats/trustBadges and suitabilitySection.cards are no longer part
    // of the wire shape.
    private SpecificationsField specifications;
    private SpecStatsField specStats;
    private TrustBadgesField trustBadges;
    private QuickAnswerSummaryField quickAnswerSummary;
    private OriginBrandCountryField originBrandCountry;
    private SeoField seo;

    /** Legacy fallback for products not yet migrated to {@code descriptionBlocks} (VI only, no English). */
    private String description;

    private ImageAssetRequest image;
    private List<GalleryImageRequest> gallery;
    private List<VideoRequest> videos;
    private List<FaqRequest> faqs;
    private List<CommitmentRequest> commitments;
    private HighlightsRequest highlights;
    private List<VariantRequest> variants;
    private List<String> relatedProductIds;
    private List<String> accessoryProductIds;
    private List<DescriptionBlock> descriptionBlocks;
    private SuitabilitySection suitabilitySection;
    private SizeGuideSection sizeGuideSection;

    // Every VI/EN nested class below is annotated ALWAYS so EXPORT_MAPPER (NON_NULL by default —
    // see ProductImportService) still emits both sides of a bilingual column, null-filling whichever
    // side is blank, instead of dropping it — the two columns must stay visually paired in the file.
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class NameField {
        private String nameVI;
        private String nameEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class SlugField {
        private String slugVI;
        private String slugEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class ShortDescriptionField {
        private String shortDescriptionVI;
        private String shortDescriptionEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class SpecificationsField {
        private String specificationsVI;
        private String specificationsEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class SpecStatsField {
        private String specStatsVI;
        private String specStatsEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class TrustBadgesField {
        private String trustBadgesVI;
        private String trustBadgesEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class QuickAnswerSummaryField {
        private String quickAnswerSummaryVI;
        private String quickAnswerSummaryEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public static class OriginBrandCountryField {
        private String originBrandCountryVI;
        private String originBrandCountryEN;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SeoField {
        // titleVI/titleEN/descriptionVI/descriptionEN are the bilingual pair — always both keys.
        // canonicalUrl is not a VI/EN column (single shared URL) and keeps the default NON_NULL.
        @JsonInclude(JsonInclude.Include.ALWAYS)
        private String titleVI;
        @JsonInclude(JsonInclude.Include.ALWAYS)
        private String titleEN;
        @JsonInclude(JsonInclude.Include.ALWAYS)
        private String descriptionVI;
        @JsonInclude(JsonInclude.Include.ALWAYS)
        private String descriptionEN;
        private String canonicalUrl;
    }
}
