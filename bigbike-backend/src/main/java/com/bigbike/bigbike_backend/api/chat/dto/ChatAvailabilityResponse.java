package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatAvailabilityResponse(
        String mode,
        String reason,
        int maxTurns,
        ChatContactResponse contacts,
        int memoryDays,
        ChatImageAvailabilityResponse images
) {}
