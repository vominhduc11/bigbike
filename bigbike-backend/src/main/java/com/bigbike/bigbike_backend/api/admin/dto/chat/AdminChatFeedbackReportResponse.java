package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.LocalDate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AdminChatFeedbackReportResponse(
        long helpful,
        long unhelpful,
        List<Issue> issues,
        List<Week> weeklyTrend,
        List<Sample> samples
) {
    public record Issue(String topicCode, String reason, long total) {}
    public record Week(LocalDate weekStart, long helpful, long unhelpful) {}
    public record Sample(
            UUID feedbackId,
            UUID conversationId,
            UUID messageId,
            String question,
            String answer,
            String topicCode,
            String reason,
            Instant createdAt,
            long total
    ) {}
}
