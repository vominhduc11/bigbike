package com.bigbike.bigbike_backend.api.chat.dto;

import java.math.BigDecimal;

public record ChatProductCardResponse(
        String slug,
        String name,
        String imageUrl,
        BigDecimal retailPrice,
        BigDecimal salePrice,
        String currency,
        String stockState
) {}
