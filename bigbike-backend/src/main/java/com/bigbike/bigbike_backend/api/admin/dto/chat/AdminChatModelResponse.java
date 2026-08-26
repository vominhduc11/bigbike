package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.math.BigDecimal;
import java.time.LocalDate;

public record AdminChatModelResponse(
        String id,
        String displayName,
        String speedTier,
        String costTier,
        String speedDescriptionVi,
        String speedDescriptionEn,
        String costDescriptionVi,
        String costDescriptionEn,
        BigDecimal inputUsdPerMillion,
        BigDecimal outputUsdPerMillion,
        boolean supportsImages,
        boolean available,
        boolean selectable,
        String reason,
        LocalDate priceEffectiveFrom,
        String pricingSource
) {}
