package com.bigbike.bigbike_backend.api.admin.dto.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatImageResponse;
import com.bigbike.bigbike_backend.api.chat.dto.ChatVideoResponse;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Stored AI/customer content and result classification; provider telemetry is not exposed. */
public record AdminChatMessageResponse(
        UUID id,
        long sequenceNo,
        String role,
        String content,
        String source,
        boolean aiCalled,
        String answerFormat,
        String resultKind,
        String productsJson,
        Instant createdAt,
        List<ChatImageResponse> images,
        List<ChatVideoResponse> videos
) {
    public AdminChatMessageResponse(UUID id, long sequenceNo, String role, String content, String source,
            boolean aiCalled, String answerFormat, String resultKind, String productsJson,
            Instant createdAt, List<ChatImageResponse> images) {
        this(id, sequenceNo, role, content, source, aiCalled, answerFormat, resultKind, productsJson,
                createdAt, images, List.of());
    }
    public AdminChatMessageResponse {
        videos = videos == null ? List.of() : List.copyOf(videos);
        images = images == null ? List.of() : List.copyOf(images);
    }
}
