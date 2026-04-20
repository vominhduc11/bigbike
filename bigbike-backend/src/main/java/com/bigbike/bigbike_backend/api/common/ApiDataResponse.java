package com.bigbike.bigbike_backend.api.common;

public record ApiDataResponse<T>(T data, ApiMeta meta) {
}

