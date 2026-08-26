package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatImageAvailabilityResponse(
        boolean enabled,
        long maxBytes,
        int maxPerTurn,
        int maxPerConversation,
        int dailyLimit,
        String disclosure
) {}
