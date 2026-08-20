package com.bigbike.bigbike_backend.api.cart.dto;

import java.util.List;
import java.util.UUID;

public record CartResponse(
        UUID id,
        String status,
        String currency,
        List<CartItemResponse> items,
        CartTotalsResponse totals,
        boolean leadPrompt,
        int leadPromptSequence
) {
    public CartResponse(
            UUID id,
            String status,
            String currency,
            List<CartItemResponse> items,
            CartTotalsResponse totals
    ) {
        this(id, status, currency, items, totals, false, 0);
    }
}
