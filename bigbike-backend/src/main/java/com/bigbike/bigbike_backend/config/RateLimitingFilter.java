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
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
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
 *   token refresh           → 30 req/min
 *   contact form            → 3 req/min
 *   cart mutations          → 30 req/min
 *   checkout / quick-buy    → 5 req/min
 *   order lookup (GET)      → 20 req/min
 *   search (GET)            → 60 req/min
 *   public review submit    → 5 req/min
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private enum LimitTier { LOGIN, REGISTER, PASSWORD_RESET, RESEND_VERIFICATION, REFRESH, CONTACT, CART, CHECKOUT, ORDER_LOOKUP, SEARCH, REVIEW }

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** IPs allowed to set X-Forwarded-For. Configurable via bigbike.trusted-proxies (comma-separated). */
    private final Set<String> trustedProxies;

    public RateLimitingFilter(
            @Value("${bigbike.trusted-proxies:127.0.0.1,::1}") String trustedProxiesConfig
    ) {
        this.trustedProxies = Arrays.stream(trustedProxiesConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    private final Map<String, Bucket> loginBuckets               = new ConcurrentHashMap<>();
    private final Map<String, Bucket> registerBuckets            = new ConcurrentHashMap<>();
    private final Map<String, Bucket> passwordResetBuckets       = new ConcurrentHashMap<>();
    private final Map<String, Bucket> resendVerificationBuckets  = new ConcurrentHashMap<>();
    private final Map<String, Bucket> refreshBuckets             = new ConcurrentHashMap<>();
    private final Map<String, Bucket> contactBuckets       = new ConcurrentHashMap<>();
    private final Map<String, Bucket> cartBuckets          = new ConcurrentHashMap<>();
    private final Map<String, Bucket> checkoutBuckets      = new ConcurrentHashMap<>();
    private final Map<String, Bucket> orderLookupBuckets   = new ConcurrentHashMap<>();
    private final Map<String, Bucket> searchBuckets        = new ConcurrentHashMap<>();
    private final Map<String, Bucket> reviewBuckets        = new ConcurrentHashMap<>();

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
            if ("/api/v1/customer/auth/resend-verification".equals(path)) {
                return LimitTier.RESEND_VERIFICATION;
            }
            if ("/api/v1/auth/refresh".equals(path) || "/api/v1/customer/auth/refresh".equals(path)) {
                return LimitTier.REFRESH;
            }
            if ("/api/v1/contact".equals(path)) {
                return LimitTier.CONTACT;
            }
            if ("/api/v1/checkout".equals(path) || "/api/v1/orders/quick-buy".equals(path)) {
                return LimitTier.CHECKOUT;
            }
            // Public review submit: POST /api/v1/products/{productId}/reviews
            if (path.startsWith("/api/v1/products/") && path.endsWith("/reviews")) {
                return LimitTier.REVIEW;
            }
        }
        if (path.startsWith("/api/v1/cart") && ("POST".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method) || "DELETE".equalsIgnoreCase(method))) {
            return LimitTier.CART;
        }
        if ("GET".equalsIgnoreCase(method)) {
            if ("/api/v1/orders/lookup".equals(path)) {
                return LimitTier.ORDER_LOOKUP;
            }
            if ("/api/v1/search".equals(path) || "/api/v1/search-suggest".equals(path)) {
                return LimitTier.SEARCH;
            }
        }
        return null;
    }

    private Bucket bucketFor(LimitTier tier, String clientIp) {
        return switch (tier) {
            case LOGIN         -> loginBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(5, Duration.ofMinutes(1)));
            case REGISTER      -> registerBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(3, Duration.ofMinutes(1)));
            case PASSWORD_RESET -> passwordResetBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(5, Duration.ofMinutes(1)));
            case RESEND_VERIFICATION -> resendVerificationBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(3, Duration.ofHours(1)));
            case REFRESH       -> refreshBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(30, Duration.ofMinutes(1)));
            case CONTACT       -> contactBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(3, Duration.ofMinutes(1)));
            case CART          -> cartBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(30, Duration.ofMinutes(1)));
            case CHECKOUT      -> checkoutBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(5, Duration.ofMinutes(1)));
            case ORDER_LOOKUP  -> orderLookupBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(20, Duration.ofMinutes(1)));
            case SEARCH        -> searchBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(60, Duration.ofMinutes(1)));
            case REVIEW        -> reviewBuckets.computeIfAbsent(clientIp,
                    ip -> newBucket(5, Duration.ofMinutes(1)));
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
        String remoteAddr = request.getRemoteAddr();
        if (trustedProxies.contains(remoteAddr)) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String candidate = forwarded.split(",")[0].trim();
                if (!candidate.isEmpty()) {
                    return candidate;
                }
            }
        }
        return remoteAddr;
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
