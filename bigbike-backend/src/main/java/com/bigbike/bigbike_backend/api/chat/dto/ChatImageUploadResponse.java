package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.UUID;

public record ChatImageUploadResponse(
        UUID conversationId,
        ChatImageResponse image
) {}
