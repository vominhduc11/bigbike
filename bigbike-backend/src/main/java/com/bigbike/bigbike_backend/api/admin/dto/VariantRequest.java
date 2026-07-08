package com.bigbike.bigbike_backend.api.admin.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;
import lombok.Setter;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class VariantRequest {

    @Size(max = 100, message = "Variant ID is too long.")
    private String id;

    // PRODUCT_RULE_SKU_001 — every variant must carry a selling SKU. Write-time
    // requirement only; the DB column stays nullable for legacy/WP-import rows.
    @NotBlank(message = "Variant SKU is required.")
    @Size(max = 100, message = "Variant SKU is too long.")
    private String sku;

    // Variant display name is no longer admin-entered — it is always derived
    // server-side from the variant's attribute options (see
    // AdminCatalogMutationService.deriveVariantName). The former free-text
    // `name` request field was removed; any value a client sends is ignored.

    private BigDecimal retailPrice;
    private boolean retailPricePresent = false;

    // Owner decision 2026-07-07: salePrice always shows in export, null-filled when the variant
    // isn't on sale, instead of being dropped. CAUTION for hand-authored IMPORT files (unlike the
    // bilingual VI/EN columns): this field is deserialized straight from JSON with no null-guard in
    // between, so an explicit `"salePrice": null` DOES call setSalePrice(null) below and flips
    // salePricePresent to true — on update that explicitly clears any existing sale price, whereas
    // omitting the key entirely never calls the setter and leaves the existing price untouched. A
    // downloaded-then-reimported file is still safe (the null only appears where the variant already
    // has no sale price, so "clearing" it is a no-op) — but when hand-writing a new import row to
    // update an existing variant without touching its sale price, omit the key, don't write null.
    @JsonInclude(JsonInclude.Include.ALWAYS)
    private BigDecimal salePrice;
    private boolean salePricePresent = false;

    // stockState is a derived field (computed from quantityOnHand). Removed from input — backend ignores it.

    @Size(max = 2048, message = "Variant image URL is too long.")
    private String imageUrl;

    @Size(max = 500, message = "Variant image alt is too long.")
    private String imageAlt;

    private Integer imageWidth;
    private Integer imageHeight;

    @Size(max = 100, message = "Variant image mimeType is too long.")
    private String imageMimeType;

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

    public void setRetailPrice(BigDecimal retailPrice) {
        this.retailPrice = retailPrice;
        this.retailPricePresent = true;
    }

    public void setSalePrice(BigDecimal salePrice) {
        this.salePrice = salePrice;
        this.salePricePresent = true;
    }
}
