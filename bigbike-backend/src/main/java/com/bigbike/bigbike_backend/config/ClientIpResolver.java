package com.bigbike.bigbike_backend.config;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Shared utility for resolving the real client IP from an HTTP request.
 *
 * Trusts X-Forwarded-For only when the direct caller (remoteAddr) is in the
 * configured trusted-proxy allowlist — the same allowlist used by RateLimitingFilter.
 * This prevents XFF spoofing by untrusted callers.
 *
 * Configuration: bigbike.trusted-proxies (comma-separated, default 127.0.0.1,::1)
 */
@Component
public class ClientIpResolver {

    private final Set<String> trustedProxies;

    public ClientIpResolver(
            @Value("${bigbike.trusted-proxies:127.0.0.1,::1}") String trustedProxiesConfig
    ) {
        this.trustedProxies = Arrays.stream(trustedProxiesConfig.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    /**
     * Returns the real client IP. If the direct requester is a trusted proxy and
     * X-Forwarded-For is present, returns the first IP in that header.
     * Otherwise falls back to request.getRemoteAddr().
     */
    public String resolve(HttpServletRequest request) {
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
}
