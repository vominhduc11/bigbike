package com.bigbike.bigbike_backend.api.common;

public record PaginationMeta(
        int page,
        int pageSize,
        long totalItems,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious
) {
}

