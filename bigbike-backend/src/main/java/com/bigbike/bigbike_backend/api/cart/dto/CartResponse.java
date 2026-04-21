package com.bigbike.bigbike_backend.api.cart.dto;

import java.util.List;
import java.util.UUID;

public record CartResponse(
        UUID id,
        String status,
        String currency,
        List<CartItemResponse> items,
        CartTotalsResponse totals
) {}
