package com.bigbike.bigbike_backend.domain.catalog;

public record ProductPrice(
        int retailPrice,
        Integer compareAtPrice,
        Integer salePrice,
        String currency
) {
}

