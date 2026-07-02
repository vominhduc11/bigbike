package com.bigbike.bigbike_backend.api.public_.dto;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.slider.Slider;

public record PublicSliderResponse(
        String id,
        Integer sortOrder,
        String location,
        ImageAsset desktopImage,
        ImageAsset mobileImage,
        String productId,
        /** Linked product's display name — lets the web caption a banner without a separate product-detail call. */
        String productName,
        /** Linked product's primary category name. Null when the product has no category or no product is linked. */
        String categoryName,
        /** Linked product's SKU — rendered as the banner's "product code" caption. */
        String sku,
        String externalLink,
        String productLink,
        String link
) {
    public static PublicSliderResponse from(Slider slider) {
        return new PublicSliderResponse(
                slider.id(),
                slider.sortOrder(),
                slider.location(),
                slider.desktopImage(),
                slider.mobileImage(),
                slider.productId(),
                slider.product() != null ? slider.product().name() : null,
                slider.product() != null && slider.product().category() != null
                        ? slider.product().category().name()
                        : null,
                slider.product() != null ? slider.product().sku() : null,
                slider.externalLink(),
                slider.productLink(),
                slider.link()
        );
    }
}
