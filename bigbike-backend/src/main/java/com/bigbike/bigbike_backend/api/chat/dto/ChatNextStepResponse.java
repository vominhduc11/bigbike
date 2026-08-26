package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatNextStepResponse(
        String type,
        String productSlug,
        String clarificationId
) {}
