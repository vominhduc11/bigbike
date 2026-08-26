package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;

public record AdminChatModelUsageResponse(
        String modelId,
        long uses,
        BigDecimal costUsd
) {}
