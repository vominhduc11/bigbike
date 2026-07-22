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
    public static HomeHighlightItemDto from(HomeHighlightEntity e, String lang) {
        var product = e.getProduct();
        var category = product.getCategories() == null || product.getCategories().isEmpty()
                ? null
                : product.getCategories().get(0);
        return new HomeHighlightItemDto(
                e.getSlot(),
                product.getId(),
                product.getSlug(),
                pick(product.getName(), product.getNameEn(), lang),
                product.getImageUrl(),
                category == null ? null : category.getId(),
                category == null ? null : pick(category.getName(), category.getNameEn(), lang),
                category == null ? null : category.getSlug()
        );
    }

    /** EN-with-Vietnamese-fallback per PRODUCT_RULE_002. */
    private static String pick(String base, String en, String lang) {
        return "en".equalsIgnoreCase(lang) && en != null && !en.isBlank() ? en : base;
    }
}
