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
        List<ChatActionResponse> actions,
        ChatContactResponse contacts,
        List<ChatProductCardResponse> crossSellProducts,
        String salesStage,
        ChatNextStepResponse nextStep,
        int countedTurns,
        int turnLimit,
        int turnsRemaining,
        ChatContinuationResponse continuation
) {
    public ChatMessageResponse {
        products = products == null ? List.of() : List.copyOf(products);
        actions = actions == null ? List.of() : List.copyOf(actions);
        crossSellProducts = crossSellProducts == null ? List.of() : List.copyOf(crossSellProducts);
        salesStage = salesStage == null || salesStage.isBlank() ? "BROWSING" : salesStage;
    }
}
