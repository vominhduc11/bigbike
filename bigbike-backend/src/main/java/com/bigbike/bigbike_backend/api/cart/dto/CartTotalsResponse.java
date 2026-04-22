package com.bigbike.bigbike_backend.api.cart.dto;

import java.math.BigDecimal;

public record CartTotalsResponse(
        BigDecimal subtotalAmount,
        BigDecimal discountAmount,
        BigDecimal shippingAmount,
        BigDecimal feeAmount,
        BigDecimal totalAmount
) {}
