package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatVideoAvailabilityResponse(boolean enabled, long maxBytes, int maxDurationSeconds,
        int maxPerTurn, int maxPerConversation, int dailyLimit) {}
