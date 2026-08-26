package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatProactiveSettingsResponse(
        boolean enabled,
        int productSeconds,
        int cartSeconds
) {}
