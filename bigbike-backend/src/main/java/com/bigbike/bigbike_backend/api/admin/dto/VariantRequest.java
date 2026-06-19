package com.bigbike.bigbike_backend.api.admin.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public class VariantRequest {

    @Size(max = 100, message = "Variant ID is too long.")
    private String id;

    // PRODUCT_RULE_SKU_001 — every variant must carry a selling SKU. Write-time
    // requirement only; the DB column stays nullable for legacy/WP-import rows.
    @NotBlank(message = "Variant SKU is required.")
    @Size(max = 100, message = "Variant SKU is too long.")
    private String sku;

    @Size(max = 255, message = "Variant name is too long.")
    private String name;

    private BigDecimal retailPrice;
    private boolean retailPricePresent = false;
    private BigDecimal compareAtPrice;
    private boolean compareAtPricePresent = false;
    private BigDecimal salePrice;
    private boolean salePricePresent = false;
    private BigDecimal costPrice;
    private boolean costPricePresent = false;

    // stockState is a derived field (computed from quantityOnHand). Removed from input — backend ignores it.

    // The variant cover image is no longer entered separately — it is always the
    // first image of the color gallery (see AdminCatalogMutationService.applyVariants
    // / colorCoverImages). The former imageUrl/imageAlt request fields were removed.

    private Boolean isAvailable;

    private Integer sortOrder;

    @Valid
    private List<VariantOptionRequest> options;

    /**
     * Color-scoped gallery. Backend normalizes this list across variants with
     * the same Color/Mau option and rejects gallery on variants without color.
     */
    @Valid
    @Size(max = 50, message = "Variant gallery may not have more than 50 images.")
    private List<GalleryImageRequest> gallery;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public BigDecimal getRetailPrice() { return retailPrice; }
    public void setRetailPrice(BigDecimal retailPrice) {
        this.retailPrice = retailPrice;
        this.retailPricePresent = true;
    }

    public boolean isRetailPricePresent() { return retailPricePresent; }

    public BigDecimal getCompareAtPrice() { return compareAtPrice; }
    public void setCompareAtPrice(BigDecimal compareAtPrice) {
        this.compareAtPrice = compareAtPrice;
        this.compareAtPricePresent = true;
    }

    public boolean isCompareAtPricePresent() { return compareAtPricePresent; }

    public BigDecimal getSalePrice() { return salePrice; }
    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
        this.salePricePresent = true;
    }

    public boolean isSalePricePresent() { return salePricePresent; }

    public BigDecimal getCostPrice() { return costPrice; }
    public void setCostPrice(BigDecimal costPrice) {
        this.costPrice = costPrice;
        this.costPricePresent = true;
    }

    public boolean isCostPricePresent() { return costPricePresent; }

    public Boolean getIsAvailable() { return isAvailable; }
    public void setIsAvailable(Boolean isAvailable) { this.isAvailable = isAvailable; }

    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }

    public List<VariantOptionRequest> getOptions() { return options; }
    public void setOptions(List<VariantOptionRequest> options) { this.options = options; }

    public List<GalleryImageRequest> getGallery() { return gallery; }
    public void setGallery(List<GalleryImageRequest> gallery) { this.gallery = gallery; }
}
