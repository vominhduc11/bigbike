package com.bigbike.bigbike_backend.api.admin.dto.quicksearch;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AdminQuickSearchVariant(
        String id,
        String sku,
        String name,
        List<AdminQuickSearchVariantOption> options
) {
    public AdminQuickSearchVariant {
        options = options == null ? List.of() : List.copyOf(options);
    }
}
