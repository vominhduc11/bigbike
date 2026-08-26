package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatAiUsageEventEntity;
import com.bigbike.bigbike_backend.persistence.repository.chat.ChatAiUsageEventJpaRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ChatAiUsageService {

    private final ChatAiUsageEventJpaRepository repository;

    @Transactional
    public void recordText(
            UUID conversationId,
            UUID messageId,
            String requestedModel,
            String servedModel,
            int providerRequests,
            int inputTokens,
            int outputTokens,
            int thinkingTokens,
            BigDecimal cost,
            LocalDate priceEffectiveFrom,
            boolean fallback,
            boolean success,
            int latencyMs
    ) {
        record("CUSTOMER_TEXT", conversationId, messageId, null, requestedModel, servedModel,
                providerRequests, inputTokens, outputTokens, thinkingTokens, 0, cost,
                priceEffectiveFrom, fallback, success, latencyMs);
    }

    @Transactional
    public void record(
            String category,
            UUID conversationId,
            UUID messageId,
            UUID evaluationRunId,
            String requestedModel,
            String servedModel,
            int providerRequests,
            int inputTokens,
            int outputTokens,
            int thinkingTokens,
            int imageCount,
            BigDecimal cost,
            LocalDate priceEffectiveFrom,
            boolean fallback,
            boolean success,
            int latencyMs
    ) {
        ChatAiUsageEventEntity event = new ChatAiUsageEventEntity();
        event.setCategory(category);
        event.setConversationId(conversationId);
        event.setMessageId(messageId);
        event.setEvaluationRunId(evaluationRunId);
        event.setRequestedModel(requestedModel);
        event.setModelId(servedModel);
        event.setProviderRequestCount(Math.max(0, providerRequests));
        event.setInputTokens(Math.max(0, inputTokens));
        event.setOutputTokens(Math.max(0, outputTokens));
        event.setThinkingTokens(Math.max(0, thinkingTokens));
        event.setImageCount(Math.max(0, imageCount));
        event.setEstimatedCostUsd(cost == null || cost.signum() < 0 ? BigDecimal.ZERO : cost);
        event.setPriceEffectiveFrom(Objects.requireNonNull(
                priceEffectiveFrom,
                "A verified price effective date is required for AI cost telemetry"));
        event.setFallback(fallback);
        event.setSuccess(success);
        event.setLatencyMs(Math.max(0, latencyMs));
        repository.save(event);
    }
}
