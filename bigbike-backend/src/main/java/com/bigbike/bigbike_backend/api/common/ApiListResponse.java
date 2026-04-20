package com.bigbike.bigbike_backend.api.common;

import java.util.List;

public record ApiListResponse<T>(List<T> data, PaginationMeta pagination, ApiMeta meta) {
}

