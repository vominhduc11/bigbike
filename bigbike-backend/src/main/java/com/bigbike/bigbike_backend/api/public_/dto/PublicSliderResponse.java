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
                slider.externalLink(),
                slider.productLink(),
                slider.link()
        );
    }
}
