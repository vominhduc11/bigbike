package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.LocalDate;

/** The daily quota remains visible because it is the cost guardrail. */
public record AdminChatStatsResponse(
        LocalDate date,
        LocalDate periodFrom,
        LocalDate periodTo,
        long used,
        int limit,
        long remaining,
        long conversations,
        AdminChatQualityStatsResponse quality
) {}
