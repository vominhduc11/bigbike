package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.api.common.ApiError;
import com.bigbike.bigbike_backend.api.common.ApiErrorResponse;
import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ApiMetaFactory apiMetaFactory;
    private final ObjectMapper objectMapper;

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException
    ) throws IOException {
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        ApiErrorResponse body = new ApiErrorResponse(
                new ApiError("FORBIDDEN", "Access denied.", List.of()),
                apiMetaFactory.from(request)
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
