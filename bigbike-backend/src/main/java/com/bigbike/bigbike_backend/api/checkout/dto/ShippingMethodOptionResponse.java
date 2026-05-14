package com.bigbike.bigbike_backend.api.checkout.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ShippingMethodOptionResponse(
        UUID id,
        String code,
        String title,
        BigDecimal cost,
        BigDecimal freeShippingThreshold,
        BigDecimal minOrderAmount
) {}
