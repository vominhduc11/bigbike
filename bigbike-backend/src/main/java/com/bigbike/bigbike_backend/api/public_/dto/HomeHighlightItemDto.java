package com.bigbike.bigbike_backend.api.public_.dto;

import com.bigbike.bigbike_backend.persistence.entity.home.HomeHighlightEntity;

public record HomeHighlightItemDto(
        int slot,
        String productId,
        String productSlug,
        String productName,
        String productImageUrl,
        String categoryId,
        String categoryName,
        String categorySlug
) {
    public static HomeHighlightItemDto from(HomeHighlightEntity e) {
        var product = e.getProduct();
        var category = product.getCategory();
        return new HomeHighlightItemDto(
                e.getSlot(),
                product.getId(),
                product.getSlug(),
                product.getName(),
                product.getImageUrl(),
                category.getId(),
                category.getName(),
                category.getSlug()
        );
    }
}
