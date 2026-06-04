package com.bigbike.bigbike_backend.domain.catalog;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One picked attribute on a variant (e.g. {@code Màu sắc} / {@code Đen bóng}).
 *
 * <p>{@code attributeValueId} is an <b>admin-only</b> round-trip reference: the
 * read path returns {@code value} as the human label ("Đen bóng"), not the
 * stored slug ("den-bong"), so the admin editor needs the raw dictionary value
 * id to re-save a product without losing the colour link. It is populated only
 * for the admin view (see {@code JpaCatalogReadRepository.toVariantOption}) and
 * omitted from the public storefront response via {@link JsonInclude}.
 *
 * <p>Colour variants render on the storefront from the variant's own gallery
 * image (see {@code VariantSelector.tsx}); there is no per-term colour swatch or
 * hex value.
 */
public record ProductVariantOption(
        String name,
        String value,
        @JsonInclude(JsonInclude.Include.NON_NULL) String attributeValueId
) {
    public ProductVariantOption(String name, String value) {
        this(name, value, null);
    }
}
