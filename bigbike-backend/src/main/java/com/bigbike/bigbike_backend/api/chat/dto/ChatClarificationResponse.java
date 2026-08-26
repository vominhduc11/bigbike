package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.List;
import java.util.UUID;

public record ChatClarificationResponse(
        UUID id,
        String criterion,
        List<ChatClarificationOptionResponse> options
) {
    public ChatClarificationResponse {
        options = options == null ? List.of() : List.copyOf(options).stream().limit(12).toList();
    }
}
