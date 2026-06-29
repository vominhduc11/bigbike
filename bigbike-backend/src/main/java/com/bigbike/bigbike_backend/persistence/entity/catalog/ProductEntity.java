package com.bigbike.bigbike_backend.persistence.entity.catalog;

import lombok.Getter;
import lombok.Setter;
import com.bigbike.bigbike_backend.domain.catalog.DescriptionBlock;
import com.bigbike.bigbike_backend.domain.catalog.ProductTab;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.converter.DescriptionBlocksConverter;
import com.bigbike.bigbike_backend.persistence.converter.ProductTabsConverter;
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

    /** JSON array of English fields/sections the admin edited by hand (translation lock, V296). */
    @Column(name = "en_overrides", columnDefinition = "text")
    private String enOverrides;

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

    @Column(name = "compare_at_price", precision = 19, scale = 2)
    private BigDecimal compareAtPrice;

    @Column(name = "sale_price", precision = 19, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "cost_price", precision = 19, scale = 2)
    private BigDecimal costPrice;

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

    @Column(name = "force_out_of_stock")
    private Boolean forceOutOfStock;

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

    @Column(name = "promotion_content", columnDefinition = "text")
    private String promotionContent;

    @Column(name = "installation_guide", columnDefinition = "text")
    private String installationGuide;

    // Dòng "Giao hàng" / "Đổi trả" của khối "Mua tại BigBike.vn" (V247). 1 ngôn ngữ; detail-only.
    @Column(name = "pdp_shipping_line", columnDefinition = "text")
    private String pdpShippingLine;

    @Column(name = "pdp_return_line", columnDefinition = "text")
    private String pdpReturnLine;

    @Column(name = "origin_brand_country", length = 120)
    private String originBrandCountry;

    @Column(name = "size_guide", columnDefinition = "text")
    private String sizeGuide;

    // "Hiển thị trên web" (V245) — admin bật/tắt từng section PDP. Opaque JSON string {sectionKey: boolean};
    // backend chỉ truyền qua, admin serialize / web parse. Null = chưa quyết → web hiện theo nội dung (legacy).
    @Column(name = "section_visibility", columnDefinition = "text")
    private String sectionVisibility;

    // "Phù hợp với ai" — JSON array các thẻ [{audience, advice, linkLabel?, linkUrl?}] (V237; format V240).
    // Bilingual dual-text (vi canonical + _en); detail-only.
    // Opaque string giống size_guide; web parse JSON khi render.
    @Column(name = "suitability_advisory", columnDefinition = "text")
    private String suitabilityAdvisory;

    // "Dán mã HTML" cho khối Thông số kỹ thuật (V255) — khi non-blank, web render HTML này
    // THAY cho bảng product_specifications có cấu trúc ("html thắng"). Bilingual dual-text
    // (vi canonical + _en); detail-only. Opaque string; web sanitize khi render.
    @Column(name = "specifications_html", columnDefinition = "text")
    private String specificationsHtml;

    // "Dán mã HTML" cho khối "Ô số liệu nổi bật" (specStats, V256) — khi non-blank, web render HTML
    // này THAY cho lưới product_spec_stats có cấu trúc. Bilingual dual-text (vi + _en); detail-only.
    @Column(name = "spec_stats_html", columnDefinition = "text")
    private String specStatsHtml;

    // "Dán mã HTML" cho khối "Dải tin cậy" (trustBadges, V257) — khi non-blank, web render HTML này
    // THAY cho dải product_trust_badges có cấu trúc. Bilingual dual-text (vi + _en); detail-only.
    @Column(name = "trust_badges_html", columnDefinition = "text")
    private String trustBadgesHtml;

    @Column(name = "gender", length = 20)
    private String gender;

    /** Structured description blocks (V139). Null for products authored via legacy RichTextEditor. */
    @Convert(converter = DescriptionBlocksConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description_blocks", columnDefinition = "jsonb")
    private List<DescriptionBlock> descriptionBlocks;

    /**
     * English structured description blocks (V229). Null when English is authored as legacy HTML
     * (description_en) or not translated. Rendered to description_en HTML on save, mirroring the
     * Vietnamese description_blocks pipeline.
     */
    @Convert(converter = DescriptionBlocksConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "description_blocks_en", columnDefinition = "jsonb")
    private List<DescriptionBlock> descriptionBlocksEn;

    /**
     * Per-product PDP tab configuration (V231). Null = product uses the default tab set. Stored canonical:
     * each tab's {@code label}/{@code blocks} = Vietnamese, {@code labelEn}/{@code blocksEn} = English.
     */
    @Convert(converter = ProductTabsConverter.class)
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "product_tabs", columnDefinition = "jsonb")
    private List<ProductTab> productTabs;

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

    @Column(name = "promotion_content_en", columnDefinition = "text")
    private String promotionContentEn;

    @Column(name = "installation_guide_en", columnDefinition = "text")
    private String installationGuideEn;

    @Column(name = "seo_title_en")
    private String seoTitleEn;

    @Column(name = "seo_description_en", columnDefinition = "text")
    private String seoDescriptionEn;

    @Column(name = "suitability_advisory_en", columnDefinition = "text")
    private String suitabilityAdvisoryEn;

    @Column(name = "specifications_html_en", columnDefinition = "text")
    private String specificationsHtmlEn;

    @Column(name = "spec_stats_html_en", columnDefinition = "text")
    private String specStatsHtmlEn;

    @Column(name = "trust_badges_html_en", columnDefinition = "text")
    private String trustBadgesHtmlEn;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductGalleryImageEntity> gallery;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductVideoEntity> videos;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductSpecificationEntity> specifications;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductSpecStatEntity> specStats;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductFaqEntity> faqs;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductCommitmentEntity> commitments;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductTrustBadgeEntity> trustBadges;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductHighlightEntity> highlights;

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
