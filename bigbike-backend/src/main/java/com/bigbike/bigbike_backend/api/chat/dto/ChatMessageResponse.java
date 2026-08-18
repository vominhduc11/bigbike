package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.List;
import java.util.UUID;

public record ChatMessageResponse(
        UUID conversationId,
        String mode,
        String reason,
        String answer,
        String answerFormat,
        String resultKind,
        int turnCount,
        int maxTurns,
        int remainingTurns,
        List<ChatProductCardResponse> products,
        boolean handoffRecommended,
        boolean leadPrompt,
        List<ChatActionResponse> actions,
        ChatContactResponse contacts
) {}
