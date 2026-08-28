package com.bigbike.bigbike_backend.api.admin.dto.quicksearch;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

public record AdminQuickSearchResponse(Map<String, AdminQuickSearchGroup> groups) {

    public AdminQuickSearchResponse {
        groups = groups == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(groups));
    }
}
