package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatLeadOfferDetailsResponse(
        int sequence,
        String reason,
        String presentation
) {}
