package com.bigbike.bigbike_backend.domain.catalog;

/**
 * One picked attribute on a variant. The optional {@code colorHex} and
 * {@code swatchImageUrl} fields are surfaced from {@code AttributeValueEntity}
 * so storefront variant chips can render visual swatches (mirrors WP theme
 * behaviour where {@code pa_color} chips display the term-level ACF
 * {@code color}/{@code image} fields as the chip background).
 */
public record ProductVariantOption(
        String name,
        String value,
        String colorHex,
        String swatchImageUrl
) {
    public ProductVariantOption(String name, String value) {
        this(name, value, null, null);
    }
}

