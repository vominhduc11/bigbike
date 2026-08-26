package com.bigbike.bigbike_backend.api.cart.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AttachAssistantAttributionRequest(
        @NotBlank @Size(max = 255) String productId,
        @NotBlank @Size(max = 2048) String attributionToken
) {}
