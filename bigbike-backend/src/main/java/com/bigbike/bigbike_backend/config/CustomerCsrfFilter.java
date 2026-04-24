package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.api.common.ApiError;
import com.bigbike.bigbike_backend.api.common.ApiErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Component
public class CustomerCsrfFilter extends OncePerRequestFilter {

    static final String CSRF_COOKIE = "bb_csrf";
    static final String CSRF_HEADER = "X-CSRF-Token";

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private static final Set<String> EXEMPT_PREFIXES = Set.of(
            "/api/v1/auth/",
            "/api/v1/admin/",
            "/api/v1/customer/auth/register",
            "/api/v1/customer/auth/login",
            "/api/v1/customer/auth/refresh",
            "/api/v1/customer/auth/password/forgot",
            "/api/v1/customer/auth/password/reset"
    );

    private final ObjectMapper objectMapper;

    public CustomerCsrfFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        if (SAFE_METHODS.contains(request.getMethod()) || isExempt(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String cookieValue = CustomerSessionFilter.extractCookie(request, CSRF_COOKIE);
        String headerValue = request.getHeader(CSRF_HEADER);

        if (cookieValue == null || !cookieValue.equals(headerValue)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            ApiErrorResponse body = new ApiErrorResponse(
                    new ApiError("CSRF_INVALID", "CSRF token mismatch.", List.of()), null);
            response.getWriter().write(objectMapper.writeValueAsString(body));
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isExempt(String uri) {
        for (String prefix : EXEMPT_PREFIXES) {
            if (uri.startsWith(prefix)) return true;
        }
        return false;
    }
}
