package com.bigbike.bigbike_backend.config;

import com.bigbike.bigbike_backend.api.common.ApiError;
import com.bigbike.bigbike_backend.api.common.ApiErrorResponse;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.ObjectMapper;

@Component
@RequiredArgsConstructor
public class CustomerCsrfFilter extends OncePerRequestFilter {

    static final String CSRF_COOKIE = "bb_csrf";
    static final String CSRF_HEADER = "X-CSRF-Token";

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    /**
     * Exact URI paths that are exempt from CSRF validation.
     * Auth endpoints are exempt because they either set up the session (register/login)
     * or don't require an existing authenticated session (forgot/reset, verify-email).
     * Admin endpoints use a separate admin session and are NOT exempted here.
     */
    private static final Set<String> CSRF_EXEMPT_EXACT = Set.of(
            "/api/v1/customer/auth/register",
            "/api/v1/customer/auth/login",
            "/api/v1/customer/auth/refresh",
            "/api/v1/customer/auth/password/forgot",
            "/api/v1/customer/auth/password/reset",
            "/api/v1/customer/auth/verify-email"
    );

    /**
     * URI prefixes exempt from CSRF (non-customer public APIs).
     * Keep this list minimal — each entry is a potential CSRF bypass surface.
     */
    private static final Set<String> CSRF_EXEMPT_PREFIXES = Set.of(
            "/api/v1/auth/",         // admin auth (has its own CSRF)
            "/api/v1/admin/",        // admin API uses JWT Bearer tokens, not cookies — CSRF not needed
            "/api/v1/contact",       // public contact form (no session required)
            "/api/internal/"         // internal API (called server-to-server)
    );

    private final ObjectMapper objectMapper;

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

        if (cookieValue == null || headerValue == null || !constantTimeEquals(cookieValue, headerValue)) {
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
        if (CSRF_EXEMPT_EXACT.contains(uri)) return true;
        for (String prefix : CSRF_EXEMPT_PREFIXES) {
            if (uri.startsWith(prefix)) return true;
        }
        return false;
    }

    /** Constant-time string comparison to prevent timing attacks. */
    private static boolean constantTimeEquals(String a, String b) {
        byte[] aBytes = a.getBytes(StandardCharsets.UTF_8);
        byte[] bBytes = b.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(aBytes, bBytes);
    }
}
