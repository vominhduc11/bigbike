package com.bigbike.bigbike_backend.api.common;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class ApiMetaFactory {

    public static final String REQUEST_ID_ATTRIBUTE = "requestId";

    public ApiMeta from(HttpServletRequest request) {
        Object requestId = request.getAttribute(REQUEST_ID_ATTRIBUTE);
        String finalRequestId = requestId instanceof String id ? id : UUID.randomUUID().toString();
        return new ApiMeta(finalRequestId, Instant.now());
    }
}

