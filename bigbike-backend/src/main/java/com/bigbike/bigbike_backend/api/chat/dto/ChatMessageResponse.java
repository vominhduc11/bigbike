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
        ChatClarificationResponse clarification,
        boolean handoffRecommended,
        List<ChatActionResponse> actions,
        ChatContactResponse contacts,
        List<ChatProductCardResponse> crossSellProducts,
        String salesStage,
        ChatNextStepResponse nextStep,
        ChatHandoffStatusResponse handoff,
        String channelState,
        int countedTurns,
        int turnLimit,
        int turnsRemaining,
        ChatContinuationResponse continuation
) {
    public ChatMessageResponse(
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
            ChatClarificationResponse clarification,
            boolean handoffRecommended,
            List<ChatActionResponse> actions,
            ChatContactResponse contacts
    ) {
        this(
                conversationId, assistantMessageId, mode, reason, answer, answerFormat,
                resultKind, turnCount, maxTurns, remainingTurns, products, clarification,
                handoffRecommended, actions, contacts,
                List.of(), "BROWSING", null, null,
                "AI_ACTIVE", turnCount, maxTurns, remainingTurns, null);
    }

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
            List<ChatActionResponse> actions,
            ChatContactResponse contacts
    ) {
        this(
                conversationId, null, mode, reason, answer, answerFormat, resultKind,
                turnCount, maxTurns, remainingTurns, products, null, handoffRecommended,
                actions, contacts,
                List.of(), "BROWSING", null, null,
                "AI_ACTIVE", turnCount, maxTurns, remainingTurns, null);
    }

    public ChatMessageResponse {
        products = products == null ? List.of() : List.copyOf(products);
        actions = actions == null ? List.of() : List.copyOf(actions);
        crossSellProducts = crossSellProducts == null ? List.of() : List.copyOf(crossSellProducts);
        salesStage = salesStage == null || salesStage.isBlank() ? "BROWSING" : salesStage;
        channelState = channelState == null || channelState.isBlank() ? "AI_ACTIVE" : channelState;
    }
}
