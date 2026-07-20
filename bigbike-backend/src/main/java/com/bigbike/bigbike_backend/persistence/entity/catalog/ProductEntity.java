package com.bigbike.bigbike_backend.persistence.entity.catalog;

import lombok.Getter;
import lombok.Setter;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.GalleryMedia;
import com.bigbike.bigbike_backend.domain.catalog.ProductCommitment;
import com.bigbike.bigbike_backend.domain.catalog.ProductFaq;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SizeGuideSection;
import com.bigbike.bigbike_backend.domain.catalog.SuitabilitySection;
import com.bigbike.bigbike_backend.domain.catalog.VideoAsset;
import com.bigbike.bigbike_backend.persistence.converter.DescriptionBlocksConverter;
import com.bigbike.bigbike_backend.persistence.converter.ProductCommitmentsConverter;
import com.bigbike.bigbike_backend.persistence.converter.ProductFaqsConverter;
import com.bigbike.bigbike_backend.persistence.converter.ProductGalleryConverter;
import com.bigbike.bigbike_backend.persistence.converter.ProductHighlightsConverter;
import com.bigbike.bigbike_backend.persistence.converter.ProductVideosConverter;
import com.bigbike.bigbike_backend.persistence.converter.SizeGuideSectionConverter;
import com.bigbike.bigbike_backend.persistence.converter.SuitabilitySectionConverter;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
@Getter
@Setter
public class ProductEntity {

    @Id
    private String id;

    @Column(name = "legacy_id", unique = true)
    private String legacyId;

    private String sku;

    @Column(nullable = false, unique = true)
    private String slug;

    @Column(name = "slug_en")
    private String slugEn;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String shortDescription;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "brand_id")
    private BrandEntity brand;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    private CategoryEntity category;

    private String imageId;

    @Column(columnDefinition = "text")
    private String imageUrl;

    private String imageAlt;
    private Integer imageWidth;
    private Integer imageHeight;
    private String imageMimeType;

    @Column(name = "retail_price", nullable = false, precision = 19, scale = 2)
    private BigDecimal retailPrice;

    @Column(name = "sale_price", precision = 19, scale = 2)
    private BigDecimal salePrice;

    @Column(nullable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductStockState stockState;

    @Column(name = "stock_quantity")
    private Integer stockQuantity;

    @Column(name = "manage_stock")
    private Boolean manageStock;

    @Column(name = "backorders", length = 16)
    private String backorders;

    @Column(name = "length_cm", precision = 10, scale = 4)
    private java.math.BigDecimal lengthCm;

    @Column(name = "width_cm", precision = 10, scale = 4)
    private java.math.BigDecimal widthCm;

    @Column(name = "height_cm", precision = 10, scale = 4)
    private java.math.BigDecimal heightCm;

    @Column(name = "available")
    private Boolean available;

    @Column(name = "discount_percent_override", precision = 5, scale = 2)
    private java.math.BigDecimal discountPercentOverride;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PublishStatus publishStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "homepage_block", nullable = false, length = 32)
    private com.bigbike.bigbike_backend.domain.catalog.HomepageBlock homepageBlock = com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.NONE;

    @Column(name = "homepage_order")
    private Integer homepageOrder;

    @Column(name = "rating", precision = 3, scale = 2)
    private BigDecimal rating;

    @Column(name = "rating_count")
    private Integer ratingCount;

    // Dòng "Giao hàng" / "Đổi trả" của khối "Mua tại BigBike.vn" (V247). 1 ngôn ngữ; detail-only.
    @Column(name = "pdp_shipping_line", columnDefinition = "text")
    private String pdpShippingLine;

    @Column(name = "pdp_return_line", columnDefinition = "text")
    private String pdpReturnLine;

    @Column(name = "origin_brand_country", length = 120)
    private String originBrandCountry;

    @Column(name = "size_guide", columnDefinition = "text")
    private String sizeGuide;

    // "Phù hợp với ai" — JSON array các thẻ [{audience, advice, linkLabel?, linkUrl?}] (V237; format V240).
    // Bilingual dual-text (vi canonical + _en); detail-only.
    // Opaque string giống size_guide; web parse JSON khi render.
    @Column(name = "suitability_advisory", columnDefinition = "text")
    private String suitabilityAdvisory;

    // "Dán mã HTML" cho khối Thông số kỹ thuật (V255). HTML là nguồn render duy nhất;
    // bảng product_specifications đã backfill và drop ở V329/V330.
    @Column(name = "specifications_html", columnDefinition = "text")
    private String specifications;

    // "Dán mã HTML" cho khối "Ô số liệu nổi bật" (V256). HTML là nguồn render duy nhất;
    // bảng product_spec_stats đã backfill và drop ở V329/V330.
    @Column(name = "spec_stats_html", columnDefinition = "text")
    private String specStats;

    // "Dán mã HTML" cho khối "Dải tin cậy" (V257). HTML là nguồn render duy nhất;
    // bảng product_trust_badges đã backfill và drop ở V329/V330.
    @Column(name = "trust_badges_html", columnDefinition = "text")
    private String trustBadges;

    // "Quick Answer" (trả lời nhanh, V300) — đoạn tóm tắt AIO 40-60 từ, blockquote ngay sau
    // Specs Dashboard, trước "Tính năng chi tiết". Bilingual dual-text (vi canonical + _en);
    // detail-only, max 600 ký tự.
    @Column(name = "quick_answer_summary", columnDefinition = "text")
    private String quickAnswerSummary;

    @Column(name = "gender", length = 20)
    private String gender;

    /**
     * Structured description blocks (V139). Each block carries both languages inline in its own
     * {@code *En} sibling fields (V326 merge) — {@code description_blocks_en} no longer exists as a
     * separate column. Null for products authored via legacy RichTextEditor.
     */
    @Convert(converter = DescriptionBlocksConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description_blocks", columnDefinition = "jsonb")
    private List<DescriptionBlock> descriptionBlocks;

    // "Phù hợp với ai" (V240, tách khỏi description_blocks ở V327/V328). Detail-only.
    @Convert(converter = SuitabilitySectionConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "suitability_section", columnDefinition = "jsonb")
    private SuitabilitySection suitabilitySection;

    // "Bảng size" (V246, tách khỏi description_blocks ở V327/V328). Detail-only.
    @Convert(converter = SizeGuideSectionConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "size_guide_section", columnDefinition = "jsonb")
    private SizeGuideSection sizeGuideSection;

    @Convert(converter = ProductFaqsConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "faqs", columnDefinition = "jsonb")
    private List<ProductFaq> faqs;

    @Convert(converter = ProductCommitmentsConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "commitments", columnDefinition = "jsonb")
    private List<ProductCommitment> commitments;

    @Convert(converter = ProductHighlightsConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "highlights", columnDefinition = "jsonb")
    private ProductHighlights highlights;

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

    // Optional English content (V136). Vietnamese stays on the columns above (canonical).
    // Null = no English; reads fall back to the Vietnamese column field-by-field.
    @Column(name = "name_en")
    private String nameEn;

    @Column(name = "short_description_en", columnDefinition = "text")
    private String shortDescriptionEn;

    @Column(name = "description_en", columnDefinition = "text")
    private String descriptionEn;

    @Column(name = "size_guide_en", columnDefinition = "text")
    private String sizeGuideEn;

    @Column(name = "seo_title_en")
    private String seoTitleEn;

    @Column(name = "seo_description_en", columnDefinition = "text")
    private String seoDescriptionEn;

    @Column(name = "suitability_advisory_en", columnDefinition = "text")
    private String suitabilityAdvisoryEn;

    @Column(name = "specifications_html_en", columnDefinition = "text")
    private String specificationsEn;

    @Column(name = "spec_stats_html_en", columnDefinition = "text")
    private String specStatsEn;

    @Column(name = "trust_badges_html_en", columnDefinition = "text")
    private String trustBadgesEn;

    @Column(name = "quick_answer_summary_en", columnDefinition = "text")
    private String quickAnswerSummaryEn;

    @Column(name = "origin_brand_country_en", length = 120)
    private String originBrandCountryEn;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @Convert(converter = ProductGalleryConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "gallery", columnDefinition = "jsonb")
    private List<GalleryMedia> gallery;

    @Convert(converter = ProductVideosConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "videos", columnDefinition = "jsonb")
    private List<VideoAsset> videos;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductVariantEntity> variants;

    /**
     * Admin-curated related products shown on the PDP "Sản phẩm liên quan" section.
     * Self-referential, ordered. No category fallback — empty list hides the section.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "product_related_product_map",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "related_product_id")
    )
    @OrderColumn(name = "sort_order")
    @BatchSize(size = 50)
    private List<ProductEntity> relatedProducts = new ArrayList<>();

    /**
     * Admin-curated accessory products ("Phụ kiện") shown on the PDP. Sản phẩm bán kèm
     * chọn từ kho. Self-referential, ordered. No fallback — empty list hides the section.
     */
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "product_accessory_product_map",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "accessory_product_id")
    )
    @OrderColumn(name = "sort_order")
    @BatchSize(size = 50)
    private List<ProductEntity> accessoryProducts = new ArrayList<>();

    public void setHomepageBlock(com.bigbike.bigbike_backend.domain.catalog.HomepageBlock homepageBlock) {
        this.homepageBlock = homepageBlock == null
                ? com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.NONE
                : homepageBlock;
    }

}
