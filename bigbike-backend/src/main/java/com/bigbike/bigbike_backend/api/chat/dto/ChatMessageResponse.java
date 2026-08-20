package com.bigbike.bigbike_backend.api.chat.dto;

import java.util.List;
import java.util.UUID;

public record ChatMessageResponse(
        UUID conversationId,
        UUID assistantMessageId,
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
        int leadPromptSequence,
        List<ChatActionResponse> actions,
        ChatContactResponse contacts
) {
    public ChatMessageResponse(
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
    ) {
        this(
                conversationId, null, mode, reason, answer, answerFormat, resultKind,
                turnCount, maxTurns, remainingTurns, products, handoffRecommended,
                leadPrompt, leadPrompt ? 1 : 0, actions, contacts);
    }
}
