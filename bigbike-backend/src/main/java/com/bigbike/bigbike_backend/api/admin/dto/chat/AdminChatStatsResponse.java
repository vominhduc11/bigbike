package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.time.LocalDate;

public record AdminChatStatsResponse(
        LocalDate date,
        long aiCalls,
        long conversations,
        long leads,
        int dailyLimit,
        long remainingAiCalls
) {}
