package com.bigbike.bigbike_backend.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

/** Standard application exception for a limiter rejection outside the servlet filter. */
public class RateLimitExceededException extends ApiException {

    private final long retryAfterSeconds;

    public RateLimitExceededException(long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED",
                "Quá nhiều yêu cầu. Vui lòng thử lại sau.", List.of());
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }

    public long retryAfterSeconds() {
        return retryAfterSeconds;
    }
}
