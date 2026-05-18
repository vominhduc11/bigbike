package com.bigbike.bigbike_backend.persistence.entity.catalog;

import lombok.Getter;
import lombok.Setter;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
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
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
            name = "product_tag_map",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "tag_id")
    )
    private Set<ProductTagEntity> tags = new LinkedHashSet<>();

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

    @Column(nullable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ProductStockState stockState;

    @Column(name = "stock_quantity")
    private Integer stockQuantity;

    @Column(name = "track_serials", nullable = false, columnDefinition = "boolean not null default false")
    private boolean trackSerials;

    @Column(name = "manage_stock")
    private Boolean manageStock;

    @Column(name = "backorders", length = 16)
    private String backorders;

    @Column(name = "weight_kg", precision = 10, scale = 4)
    private java.math.BigDecimal weightKg;

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

    @Column(name = "content_bottom", columnDefinition = "text")
    private String contentBottom;

    @Column(name = "promotion_content", columnDefinition = "text")
    private String promotionContent;

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
    private Boolean seoNoIndex;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductGalleryImageEntity> gallery;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductVideoEntity> videos;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductSpecificationEntity> specifications;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<ProductVariantEntity> variants;

    public void setHomepageBlock(com.bigbike.bigbike_backend.domain.catalog.HomepageBlock homepageBlock) {
        this.homepageBlock = homepageBlock == null
                ? com.bigbike.bigbike_backend.domain.catalog.HomepageBlock.NONE
                : homepageBlock;
    }

}
