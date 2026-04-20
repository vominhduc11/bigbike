package com.bigbike.bigbike_backend.api.common;

import java.time.Instant;

public record ApiMeta(String requestId, Instant timestamp) {
}

