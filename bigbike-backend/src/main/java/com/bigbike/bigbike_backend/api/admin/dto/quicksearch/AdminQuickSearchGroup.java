package com.bigbike.bigbike_backend.api.admin.dto.quicksearch;

import java.util.List;

public record AdminQuickSearchGroup(
        AdminQuickSearchState state,
        Long total,
        List<AdminQuickSearchItem> items,
        String errorCode
) {

    public static AdminQuickSearchGroup ready(long total, List<AdminQuickSearchItem> items) {
        return new AdminQuickSearchGroup(
                AdminQuickSearchState.READY,
                total,
                items == null ? List.of() : List.copyOf(items),
                null
        );
    }

    public static AdminQuickSearchGroup error(String errorCode) {
        return new AdminQuickSearchGroup(AdminQuickSearchState.ERROR, null, List.of(), errorCode);
    }
}
