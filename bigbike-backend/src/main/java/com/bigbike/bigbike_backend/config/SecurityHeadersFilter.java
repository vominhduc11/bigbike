package com.bigbike.bigbike_backend.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Adds security response headers to every API response.
 * HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
 * CSP for the backend API is kept minimal (no HTML is served directly).
 */
@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {
        // Prevent framing of any backend responses
        response.setHeader("X-Frame-Options", "DENY");
        // Prevent MIME-type sniffing
        response.setHeader("X-Content-Type-Options", "nosniff");
        // No referrer for cross-origin requests from API
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        // Restrict permissions for any rendered content
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        // HSTS — 1 year, include subdomains (only effective over HTTPS)
        response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

        chain.doFilter(request, response);
    }
}
