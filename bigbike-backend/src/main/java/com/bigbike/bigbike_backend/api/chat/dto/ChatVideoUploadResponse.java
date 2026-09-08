package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.UUID;

public record ChatVideoUploadResponse(UUID conversationId, ChatVideoResponse video, long remainingMillis) {}
