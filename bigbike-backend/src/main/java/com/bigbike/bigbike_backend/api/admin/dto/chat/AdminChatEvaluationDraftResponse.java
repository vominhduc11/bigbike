package com.bigbike.bigbike_backend.api.admin.dto.chat;

public record AdminChatEvaluationDraftResponse(
        int sanitizedQuestionCount,
        String draftJson,
        String notice
) {}
