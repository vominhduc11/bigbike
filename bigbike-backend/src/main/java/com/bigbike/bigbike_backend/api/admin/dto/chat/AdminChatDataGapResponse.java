package com.bigbike.bigbike_backend.api.admin.dto.chat;

import java.util.List;

public record AdminChatDataGapResponse(
        long affectedProducts,
        long missingSizeGuides,
        long missingSpecifications,
        long rawOptionProducts,
        long missingAccessoryLinks,
        List<ProductGap> items
) {
    public record ProductGap(
            String productId,
            String slug,
            String name,
            List<String> gaps,
            List<String> rawOptions
    ) {}
}
