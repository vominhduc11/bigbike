package com.bigbike.bigbike_backend.api.admin.dto.chat;

public record AdminChatQualityStatsResponse(
        long answers,
        long productResults,
        long clarifications,
        long outOfScope,
        long contentRefusals
) {}
