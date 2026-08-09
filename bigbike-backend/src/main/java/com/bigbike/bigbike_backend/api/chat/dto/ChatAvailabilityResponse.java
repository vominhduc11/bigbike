package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.List;

public record ChatAvailabilityResponse(
        String mode,
        String reason,
        String greeting,
        List<String> quickPrompts,
        int maxTurns,
        ChatContactResponse contacts
) {}
