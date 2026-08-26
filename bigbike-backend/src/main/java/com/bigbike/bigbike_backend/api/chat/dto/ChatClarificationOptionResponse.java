package com.bigbike.bigbike_backend.api.chat.dto;

public record ChatClarificationOptionResponse(
        String id,
        String label,
        Long count,
        String kind
) {}
