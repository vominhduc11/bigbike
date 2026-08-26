package com.bigbike.bigbike_backend.api.chat.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatHistoryMessageResponse(
        UUID id,
        long sequenceNo,
        String role,
        String content,
        String source,
        String answerFormat,
        String resultKind,
        String staffDisplayName,
        Instant createdAt,
        List<ChatImageResponse> images
) {
    public ChatHistoryMessageResponse {
        images = images == null ? List.of() : List.copyOf(images);
    }
}
