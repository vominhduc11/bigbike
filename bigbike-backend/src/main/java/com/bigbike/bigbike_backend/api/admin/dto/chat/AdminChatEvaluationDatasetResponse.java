package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.util.List;

public record AdminChatEvaluationDatasetResponse(
        String version,
        String checksum,
        int caseCount,
        int acceptanceCheckCount,
        int realConversationCaseCount,
        String sourceSummary,
        String descriptionVi,
        String descriptionEn,
        List<String> acceptanceCoverage,
        boolean acceptanceRegistryComplete,
        boolean needsRealQuestionReview
) {
    public AdminChatEvaluationDatasetResponse {
        acceptanceCoverage = acceptanceCoverage == null
                ? List.of() : List.copyOf(acceptanceCoverage);
    }
}
