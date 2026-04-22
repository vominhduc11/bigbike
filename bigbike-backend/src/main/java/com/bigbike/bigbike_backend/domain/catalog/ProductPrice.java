package com.bigbike.bigbike_backend.domain.catalog;

import java.math.BigDecimal;

public record ProductPrice(
        BigDecimal retailPrice,
        BigDecimal compareAtPrice,
        BigDecimal salePrice,
        String currency
) {
}
