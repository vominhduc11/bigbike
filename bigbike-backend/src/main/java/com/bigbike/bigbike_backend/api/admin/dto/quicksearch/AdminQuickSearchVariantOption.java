package com.bigbike.bigbike_backend.api.admin.dto.quicksearch;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminQuickSearchVariantOption(
        String name,
        String value,
        String attributeValueId
) {
}
