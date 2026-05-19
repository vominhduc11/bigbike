package com.bigbike.bigbike_backend.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.Duration;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 *   cart mutations          → 30 req/min
 *   checkout / quick-buy    → 5 req/min
 *   order lookup (GET)      → 20 req/min
 *   search (GET)            → 60 req/min
 *   public review submit    → 5 req/min
 */
@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private enum LimitTier { LOGIN, REGISTER, PASSWORD_RESET, RESEND_VERIFICATION, REFRESH, CART, CHECKOUT, ORDER_LOOKUP, SEARCH, REVIEW }

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Logger log = LoggerFactory.getLogger(RateLimitingFilter.class);

    /**
     * Proxies allowed to set X-Forwarded-For. Configurable via bigbike.trusted-proxies
     * (comma-separated). Each entry is either an exact IP (e.g. {@code 127.0.0.1}) or a
     * CIDR range (e.g. {@code 172.16.0.0/12}) — the latter is needed when the backend
     * runs behind a reverse proxy on a Docker bridge / private subnet whose gateway IP
     * is not fixed.
     */
    private final List<ProxyMatcher> trustedProxies;

    public RateLimitingFilter(
            @Value("${bigbike.trusted-proxies:127.0.0.1,::1}") String trustedProxiesConfig
    ) {
        this.trustedProxies = Arrays.stream(trustedProxiesConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(ProxyMatcher::parse)
                .filter(m -> m != null)
                .toList();
    }

    // Bounded LRU maps: evict oldest entry when size > MAX_BUCKET_ENTRIES.
    // Prevents unbounded memory growth under DDoS with unique source IPs.
    private static final int MAX_BUCKET_ENTRIES = 50_000;

    private final Map<String, Bucket> loginBuckets               = boundedMap();
    private final Map<String, Bucket> registerBuckets            = boundedMap();
    private final Map<String, Bucket> passwordResetBuckets       = boundedMap();
    private final Map<String, Bucket> resendVerificationBuckets  = boundedMap();
    private final Map<String, Bucket> refreshBuckets             = boundedMap();
    private final Map<String, Bucket> cartBuckets                = boundedMap();
    private final Map<String, Bucket> checkoutBuckets            = boundedMap();
    private final Map<String, Bucket> orderLookupBuckets         = boundedMap();
    private final Map<String, Bucket> searchBuckets              = boundedMap();
    private final Map<String, Bucket> reviewBuckets              = boundedMap();

    private static Map<String, Bucket> boundedMap() {
        return Collections.synchronizedMap(new LinkedHashMap<>(256, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, Bucket> eldest) {
                return size() > MAX_BUCKET_ENTRIES;
            }
        });
    }

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
        if (isTrustedProxy(remoteAddr)) {
            String forwarded = request.getHeader("X-Forwarded-For");
            if (forwarded != null && !forwarded.isBlank()) {
                String candidate = forwarded.split(",")[0].trim();
                if (!candidate.isEmpty() && isValidIp(candidate)) {
                    return candidate;
                }
            }
        }
        return remoteAddr;
    }

    private static boolean isValidIp(String ip) {
        try {
            InetAddress.getByName(ip);
            return true;
        } catch (UnknownHostException e) {
            return false;
        }
    }

    private boolean isTrustedProxy(String ip) {
        if (ip == null) {
            return false;
        }
        for (ProxyMatcher matcher : trustedProxies) {
            if (matcher.matches(ip)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Matches a remote address against a trusted-proxy config entry — either an exact
     * IP or a CIDR range. Comparison is done on raw {@link InetAddress} bytes so IPv4
     * and IPv6 (and forms like {@code ::1} vs {@code 0:0:0:0:0:0:0:1}) compare correctly.
     */
    private static final class ProxyMatcher {
        private final byte[] network;
        private final int prefixBits;       // -1 → exact-IP match

        private ProxyMatcher(byte[] network, int prefixBits) {
            this.network = network;
            this.prefixBits = prefixBits;
        }

        /** Parses one config entry; returns null (and logs) when the entry is malformed. */
        static ProxyMatcher parse(String entry) {
            try {
                int slash = entry.indexOf('/');
                if (slash < 0) {
                    return new ProxyMatcher(InetAddress.getByName(entry).getAddress(), -1);
                }
                byte[] network = InetAddress.getByName(entry.substring(0, slash)).getAddress();
                int prefix = Integer.parseInt(entry.substring(slash + 1).trim());
                if (prefix < 0 || prefix > network.length * 8) {
                    log.warn("Ignoring trusted-proxy entry with invalid CIDR prefix: {}", entry);
                    return null;
                }
                return new ProxyMatcher(network, prefix);
            } catch (UnknownHostException | NumberFormatException e) {
                log.warn("Ignoring malformed trusted-proxy entry '{}': {}", entry, e.getMessage());
                return null;
            }
        }

        boolean matches(String ip) {
            byte[] addr;
            try {
                addr = InetAddress.getByName(ip).getAddress();
            } catch (UnknownHostException e) {
                return false;
            }
            if (addr.length != network.length) {
                return false; // IPv4 vs IPv6 mismatch
            }
            if (prefixBits < 0) {
                return Arrays.equals(addr, network);
            }
            int fullBytes = prefixBits / 8;
            for (int i = 0; i < fullBytes; i++) {
                if (addr[i] != network[i]) {
                    return false;
                }
            }
            int remainingBits = prefixBits % 8;
            if (remainingBits == 0) {
                return true;
            }
            int mask = 0xFF << (8 - remainingBits);
            return (addr[fullBytes] & mask) == (network[fullBytes] & mask);
        }
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
