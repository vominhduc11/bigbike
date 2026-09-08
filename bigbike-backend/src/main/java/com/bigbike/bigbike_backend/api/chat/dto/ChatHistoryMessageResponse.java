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
        Instant createdAt,
        List<ChatImageResponse> images,
        List<ChatVideoResponse> videos
) {
    public ChatHistoryMessageResponse(UUID id, long sequenceNo, String role, String content, String source,
            String answerFormat, String resultKind, Instant createdAt, List<ChatImageResponse> images) {
        this(id, sequenceNo, role, content, source, answerFormat, resultKind, createdAt, images, List.of());
    }
    public ChatHistoryMessageResponse {
        videos = videos == null ? List.of() : List.copyOf(videos);
        images = images == null ? List.of() : List.copyOf(images);
    }
}
