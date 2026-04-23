package com.bigbike.bigbike_backend.config;

import com.bucket4j.Bandwidth;
import com.bucket4j.Bucket;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Per-IP rate limiting for sensitive endpoints using Bucket4j.
 *
 * Limits (per IP, sliding window per minute):
 *   - /api/v1/auth/login, /api/v1/customer/auth/login  → 5 req/min
 *   - /api/v1/customer/auth/register                   → 3 req/min
 *   - /api/v1/orders/lookup                            → 20 req/min
 *   - /api/v1/search                                   → 60 req/min
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    // Per-endpoint bucket maps keyed by IP — uses ConcurrentHashMap for thread safety.
    // Buckets are small (max 60 tokens) so memory footprint per IP is negligible.
    private final Map<String, Bucket> loginBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> registerBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> orderLookupBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> searchBuckets = new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    public RateLimitingFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {
        String path = request.getServletPath();
        String method = request.getMethod();

        Map<String, Bucket> targetBuckets = null;

        if ("POST".equalsIgnoreCase(method)) {
            if (path.equals("/api/v1/auth/login") || path.equals("/api/v1/customer/auth/login")) {
                targetBuckets = loginBuckets;
            } else if (path.equals("/api/v1/customer/auth/register")) {
                targetBuckets = registerBuckets;
            }
        } else if ("GET".equalsIgnoreCase(method)) {
            if (path.equals("/api/v1/orders/lookup")) {
                targetBuckets = orderLookupBuckets;
            } else if (path.equals("/api/v1/search")) {
                targetBuckets = searchBuckets;
            }
        }

        if (targetBuckets == null) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        Bucket bucket = targetBuckets.computeIfAbsent(clientIp, ip -> buildBucket(targetBuckets));

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            sendRateLimitResponse(response);
        }
    }

    private Bucket buildBucket(Map<String, Bucket> buckets) {
        Bandwidth limit;
        if (buckets == loginBuckets) {
            limit = Bandwidth.builder().capacity(5).refillIntervally(5, Duration.ofMinutes(1)).build();
        } else if (buckets == registerBuckets) {
            limit = Bandwidth.builder().capacity(3).refillIntervally(3, Duration.ofMinutes(1)).build();
        } else if (buckets == orderLookupBuckets) {
            limit = Bandwidth.builder().capacity(20).refillIntervally(20, Duration.ofMinutes(1)).build();
        } else {
            // search
            limit = Bandwidth.builder().capacity(60).refillIntervally(60, Duration.ofMinutes(1)).build();
        }
        return Bucket.builder().addLimit(limit).build();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            // Take first IP in the chain (original client)
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void sendRateLimitResponse(HttpServletResponse response) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        var body = Map.of(
                "error", Map.of(
                        "code", "RATE_LIMIT_EXCEEDED",
                        "message", "Qua nhieu yeu cau. Vui long thu lai sau.",
                        "details", new Object[0]
                )
        );
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
