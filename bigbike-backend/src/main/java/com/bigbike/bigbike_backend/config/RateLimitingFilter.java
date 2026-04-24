package com.bigbike.bigbike_backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
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
 * Limits (per IP, refill per minute):
 *   login endpoints         → 5 req/min
 *   register endpoint       → 3 req/min
 *   order lookup (GET)      → 20 req/min
 *   search (GET)            → 60 req/min
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private enum LimitTier { LOGIN, REGISTER, PASSWORD_RESET, ORDER_LOOKUP, SEARCH }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Map<String, Bucket> loginBuckets       = new ConcurrentHashMap<>();
    private final Map<String, Bucket> registerBuckets    = new ConcurrentHashMap<>();
    private final Map<String, Bucket> passwordResetBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> orderLookupBuckets = new ConcurrentHashMap<>();
    private final Map<String, Bucket> searchBuckets      = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {

        LimitTier tier = resolveTier(request);
        if (tier == null) {
            chain.doFilter(request, response);
            return;
        }

        String clientIp = resolveClientIp(request);
        Bucket bucket = bucketFor(tier, clientIp);

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            sendRateLimitResponse(response);
        }
    }

    private LimitTier resolveTier(HttpServletRequest request) {
        String path   = request.getServletPath();
        String method = request.getMethod();

        if ("POST".equalsIgnoreCase(method)) {
            if ("/api/v1/auth/login".equals(path) || "/api/v1/customer/auth/login".equals(path)) {
                return LimitTier.LOGIN;
            }
            if ("/api/v1/customer/auth/register".equals(path)) {
                return LimitTier.REGISTER;
            }
            if ("/api/v1/customer/auth/password/forgot".equals(path) || "/api/v1/customer/auth/password/reset".equals(path)) {
                return LimitTier.PASSWORD_RESET;
            }
        } else if ("GET".equalsIgnoreCase(method)) {
            if ("/api/v1/orders/lookup".equals(path)) {
                return LimitTier.ORDER_LOOKUP;
            }
            if ("/api/v1/search".equals(path)) {
                return LimitTier.SEARCH;
            }
        }
        return null;
    }

    private Bucket bucketFor(LimitTier tier, String clientIp) {
        return switch (tier) {
            case LOGIN        -> loginBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(5, Duration.ofMinutes(1)));
            case REGISTER     -> registerBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(3, Duration.ofMinutes(1)));
            case PASSWORD_RESET -> passwordResetBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(5, Duration.ofMinutes(1)));
            case ORDER_LOOKUP -> orderLookupBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(20, Duration.ofMinutes(1)));
            case SEARCH       -> searchBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(60, Duration.ofMinutes(1)));
        };
    }

    private static Bucket newBucket(long capacity, Duration period) {
        return Bucket.builder()
                .addLimit(Bandwidth.builder()
                        .capacity(capacity)
                        .refillIntervally(capacity, period)
                        .build())
                .build();
    }

    private String resolveClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
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
        MAPPER.writeValue(response.getOutputStream(), body);
    }
}
