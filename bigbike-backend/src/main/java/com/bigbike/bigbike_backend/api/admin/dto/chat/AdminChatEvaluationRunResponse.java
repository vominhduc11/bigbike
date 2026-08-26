package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminChatEvaluationRunResponse(
        UUID id,
        String datasetVersion,
        String datasetChecksum,
        List<String> modelIds,
        BigDecimal maxCostUsd,
        BigDecimal actualCostUsd,
        String status,
        String failureCode,
        Instant startedAt,
        Instant completedAt,
        List<AdminChatEvaluationModelResultResponse> results
) {
    public AdminChatEvaluationRunResponse {
        modelIds = modelIds == null ? List.of() : List.copyOf(modelIds);
        results = results == null ? List.of() : List.copyOf(results);
    }
}
