package com.bigbike.bigbike_backend.service.common;

import java.util.List;

public record PageResult<T>(
        List<T> items,
        int page,
        int pageSize,
        long totalItems,
        int totalPages
) {
}

