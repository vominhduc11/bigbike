package com.bigbike.bigbike_backend.config.ratelimit;

import com.bigbike.bigbike_backend.api.common.ApiError;
import com.bigbike.bigbike_backend.api.common.ApiErrorResponse;
import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Writes the same error contract from security filters that controllers use through advice. */
@Component
public class RateLimitResponseWriter {

    private final ApiMetaFactory apiMetaFactory;
    private final ObjectMapper objectMapper;

    public RateLimitResponseWriter(ApiMetaFactory apiMetaFactory, ObjectMapper objectMapper) {
        this.apiMetaFactory = apiMetaFactory;
        this.objectMapper = objectMapper;
    }

    public void write(HttpServletRequest request, HttpServletResponse response, RateLimitDecision decision)
            throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, Long.toString(Math.max(1, decision.retryAfterSeconds())));
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiErrorResponse body = new ApiErrorResponse(
                new ApiError("RATE_LIMIT_EXCEEDED", "Quá nhiều yêu cầu. Vui lòng thử lại sau.", List.of()),
                apiMetaFactory.from(request));
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
