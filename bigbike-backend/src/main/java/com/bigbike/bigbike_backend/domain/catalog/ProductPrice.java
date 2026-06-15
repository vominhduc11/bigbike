package com.bigbike.bigbike_backend.domain.catalog;

import java.math.BigDecimal;

public record ProductPrice(
        BigDecimal retailPrice,
        BigDecimal compareAtPrice,
        BigDecimal salePrice,
        String currency,
        // Cost price — admin-only. Populated only on admin (non-public) reads; the public
        // catalog DTO (ProductSnapshotResponse) maps an explicit price subset and never exposes it.
        BigDecimal costPrice
) {
}
