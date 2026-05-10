package com.bigbike.bigbike_backend.persistence.entity.catalog;

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
            name = "product_category_map",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "category_id")
    )
    private Set<CategoryEntity> categories = new LinkedHashSet<>();

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

    @Column(name = "track_serials", nullable = false)
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

    private Boolean isFeatured;
    private Boolean showOnHomepage;

    @Column(name = "rating", precision = 3, scale = 2)
    private BigDecimal rating;

    @Column(name = "rating_count")
    private Integer ratingCount;

    @Column(name = "content_bottom", columnDefinition = "text")
    private String contentBottom;

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

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getLegacyId() {
        return legacyId;
    }

    public void setLegacyId(String legacyId) {
        this.legacyId = legacyId;
    }

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

    public BrandEntity getBrand() {
        return brand;
    }

    public void setBrand(BrandEntity brand) {
        this.brand = brand;
    }

    public CategoryEntity getCategory() {
        return category;
    }

    public void setCategory(CategoryEntity category) {
        this.category = category;
    }

    public Set<CategoryEntity> getCategories() {
        return categories;
    }

    public void setCategories(Set<CategoryEntity> categories) {
        this.categories = categories;
    }

    public Set<ProductTagEntity> getTags() {
        return tags;
    }

    public void setTags(Set<ProductTagEntity> tags) {
        this.tags = tags;
    }

    public String getImageId() {
        return imageId;
    }

    public void setImageId(String imageId) {
        this.imageId = imageId;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getImageAlt() {
        return imageAlt;
    }

    public void setImageAlt(String imageAlt) {
        this.imageAlt = imageAlt;
    }

    public Integer getImageWidth() {
        return imageWidth;
    }

    public void setImageWidth(Integer imageWidth) {
        this.imageWidth = imageWidth;
    }

    public Integer getImageHeight() {
        return imageHeight;
    }

    public void setImageHeight(Integer imageHeight) {
        this.imageHeight = imageHeight;
    }

    public String getImageMimeType() {
        return imageMimeType;
    }

    public void setImageMimeType(String imageMimeType) {
        this.imageMimeType = imageMimeType;
    }

    public BigDecimal getRetailPrice() {
        return retailPrice;
    }

    public void setRetailPrice(BigDecimal retailPrice) {
        this.retailPrice = retailPrice;
    }

    public BigDecimal getCompareAtPrice() {
        return compareAtPrice;
    }

    public void setCompareAtPrice(BigDecimal compareAtPrice) {
        this.compareAtPrice = compareAtPrice;
    }

    public BigDecimal getSalePrice() {
        return salePrice;
    }

    public void setSalePrice(BigDecimal salePrice) {
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

    public Integer getStockQuantity() {
        return stockQuantity;
    }

    public void setStockQuantity(Integer stockQuantity) {
        this.stockQuantity = stockQuantity;
    }

    public boolean isTrackSerials() {
        return trackSerials;
    }

    public void setTrackSerials(boolean trackSerials) {
        this.trackSerials = trackSerials;
    }

    public Boolean getManageStock() {
        return manageStock;
    }

    public void setManageStock(Boolean manageStock) {
        this.manageStock = manageStock;
    }

    public String getBackorders() {
        return backorders;
    }

    public void setBackorders(String backorders) {
        this.backorders = backorders;
    }

    public java.math.BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(java.math.BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public java.math.BigDecimal getLengthCm() {
        return lengthCm;
    }

    public void setLengthCm(java.math.BigDecimal lengthCm) {
        this.lengthCm = lengthCm;
    }

    public java.math.BigDecimal getWidthCm() {
        return widthCm;
    }

    public void setWidthCm(java.math.BigDecimal widthCm) {
        this.widthCm = widthCm;
    }

    public java.math.BigDecimal getHeightCm() {
        return heightCm;
    }

    public void setHeightCm(java.math.BigDecimal heightCm) {
        this.heightCm = heightCm;
    }

    public Boolean getForceOutOfStock() {
        return forceOutOfStock;
    }

    public void setForceOutOfStock(Boolean forceOutOfStock) {
        this.forceOutOfStock = forceOutOfStock;
    }

    public java.math.BigDecimal getDiscountPercentOverride() {
        return discountPercentOverride;
    }

    public void setDiscountPercentOverride(java.math.BigDecimal discountPercentOverride) {
        this.discountPercentOverride = discountPercentOverride;
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

    public BigDecimal getRating() {
        return rating;
    }

    public void setRating(BigDecimal rating) {
        this.rating = rating;
    }

    public Integer getRatingCount() {
        return ratingCount;
    }

    public void setRatingCount(Integer ratingCount) {
        this.ratingCount = ratingCount;
    }

    public String getContentBottom() {
        return contentBottom;
    }

    public void setContentBottom(String contentBottom) {
        this.contentBottom = contentBottom;
    }

    public String getSeoTitle() {
        return seoTitle;
    }

    public void setSeoTitle(String seoTitle) {
        this.seoTitle = seoTitle;
    }

    public String getSeoDescription() {
        return seoDescription;
    }

    public void setSeoDescription(String seoDescription) {
        this.seoDescription = seoDescription;
    }

    public String getSeoCanonicalUrl() {
        return seoCanonicalUrl;
    }

    public void setSeoCanonicalUrl(String seoCanonicalUrl) {
        this.seoCanonicalUrl = seoCanonicalUrl;
    }

    public String getSeoOgImageId() {
        return seoOgImageId;
    }

    public void setSeoOgImageId(String seoOgImageId) {
        this.seoOgImageId = seoOgImageId;
    }

    public String getSeoOgImageUrl() {
        return seoOgImageUrl;
    }

    public void setSeoOgImageUrl(String seoOgImageUrl) {
        this.seoOgImageUrl = seoOgImageUrl;
    }

    public String getSeoOgImageAlt() {
        return seoOgImageAlt;
    }

    public void setSeoOgImageAlt(String seoOgImageAlt) {
        this.seoOgImageAlt = seoOgImageAlt;
    }

    public Integer getSeoOgImageWidth() {
        return seoOgImageWidth;
    }

    public void setSeoOgImageWidth(Integer seoOgImageWidth) {
        this.seoOgImageWidth = seoOgImageWidth;
    }

    public Integer getSeoOgImageHeight() {
        return seoOgImageHeight;
    }

    public void setSeoOgImageHeight(Integer seoOgImageHeight) {
        this.seoOgImageHeight = seoOgImageHeight;
    }

    public String getSeoOgImageMimeType() {
        return seoOgImageMimeType;
    }

    public void setSeoOgImageMimeType(String seoOgImageMimeType) {
        this.seoOgImageMimeType = seoOgImageMimeType;
    }

    public Boolean getSeoNoIndex() {
        return seoNoIndex;
    }

    public void setSeoNoIndex(Boolean seoNoIndex) {
        this.seoNoIndex = seoNoIndex;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    public List<ProductGalleryImageEntity> getGallery() {
        return gallery;
    }

    public void setGallery(List<ProductGalleryImageEntity> gallery) {
        this.gallery = gallery;
    }

    public List<ProductVideoEntity> getVideos() {
        return videos;
    }

    public void setVideos(List<ProductVideoEntity> videos) {
        this.videos = videos;
    }

    public List<ProductSpecificationEntity> getSpecifications() {
        return specifications;
    }

    public void setSpecifications(List<ProductSpecificationEntity> specifications) {
        this.specifications = specifications;
    }

    public List<ProductVariantEntity> getVariants() {
        return variants;
    }

    public void setVariants(List<ProductVariantEntity> variants) {
        this.variants = variants;
    }
}
