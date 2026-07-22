package com.bigbike.bigbike_backend.api.admin.dto;

import java.util.List;

public record CategoryPermanentDeleteImpactResponse(
        int requestedCategoryCount,
        List<String> rootCategoryIds,
        int descendantCategoryCount,
        int affectedProductCount,
        int reassignedProductCount
) {
}
