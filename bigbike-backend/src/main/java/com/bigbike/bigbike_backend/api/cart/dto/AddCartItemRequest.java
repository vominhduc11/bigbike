package com.bigbike.bigbike_backend.api.cart.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record AddCartItemRequest(
        @NotBlank String productId,
        String productVariantId,
        @Min(1) int quantity,
        UUID assistantConversationId,
        UUID assistantInteractionId
) {
    public AddCartItemRequest(String productId, String productVariantId, int quantity) {
        this(productId, productVariantId, quantity, null, null);
    }

    public AddCartItemRequest(
            String productId, String productVariantId, int quantity, UUID assistantConversationId) {
        this(productId, productVariantId, quantity, assistantConversationId, null);
    }
}
