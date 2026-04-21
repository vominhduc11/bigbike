package com.bigbike.bigbike_backend.api.order.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderShippingItemResponse(
        UUID id,
        String methodCode,
        String methodTitle,
        BigDecimal amount
) {}
