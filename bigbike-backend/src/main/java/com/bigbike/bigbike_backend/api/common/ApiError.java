package com.bigbike.bigbike_backend.api.common;

import java.util.List;

public record ApiError(String code, String message, List<ApiErrorDetail> details) {
}

