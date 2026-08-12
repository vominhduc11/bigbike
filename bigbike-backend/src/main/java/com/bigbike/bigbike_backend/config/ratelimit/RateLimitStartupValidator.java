package com.bigbike.bigbike_backend.config.ratelimit;

import jakarta.annotation.PostConstruct;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/** Refuses an accidentally fail-open or per-instance production configuration. */
@Component
public class RateLimitStartupValidator {

    private static final Pattern IPV4_LITERAL = Pattern.compile("^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$");

    private final RateLimitProperties properties;
    private final Environment environment;

    public RateLimitStartupValidator(RateLimitProperties properties, Environment environment) {
        this.properties = properties;
        this.environment = environment;
    }

    @PostConstruct
    void validate() {
        if (properties.getFallbackMaxEntries() < 1 || properties.getLocalEntryTtlMultiplier() < 1
                || properties.getRedisTimeoutMillis() < 1) {
            throw new IllegalStateException("Rate-limit numeric configuration values must be positive");
        }
        Set<String> knownTierKeys = Arrays.stream(RateLimitTier.values())
                .map(RateLimitTier::key)
                .collect(Collectors.toUnmodifiableSet());
        for (String configuredTier : properties.getTiers().keySet()) {
            if (!knownTierKeys.contains(configuredTier)) {
                throw new IllegalStateException("Unknown rate-limit tier override: " + configuredTier);
            }
        }
        for (RateLimitTier tier : RateLimitTier.values()) {
            // Resolve every policy at startup so a malformed dormant tier cannot quietly
            // become an unrestricted endpoint after a future route is added.
            properties.policyFor(tier);
        }
        if (!isProduction()) {
            return;
        }
        if (!properties.isEnabled()) {
            throw new IllegalStateException("Rate limiting cannot be disabled in the prod profile");
        }
        if (properties.getStore() != RateLimitProperties.Store.REDIS) {
            throw new IllegalStateException("The prod profile requires BIGBIKE_RATE_LIMIT_STORE=redis");
        }
        if (properties.getRedisUrl() == null || properties.getRedisUrl().isBlank()) {
            throw new IllegalStateException("The prod profile requires BIGBIKE_RATE_LIMIT_REDIS_URL");
        }
        URI redisUri;
        try {
            redisUri = URI.create(properties.getRedisUrl().trim());
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("BIGBIKE_RATE_LIMIT_REDIS_URL is not a valid URI", ex);
        }
        String redisScheme = redisUri.getScheme();
        String redisHost = redisUri.getHost();
        if (redisHost == null
                || (!"redis".equalsIgnoreCase(redisScheme) && !"rediss".equalsIgnoreCase(redisScheme))) {
            throw new IllegalStateException(
                    "BIGBIKE_RATE_LIMIT_REDIS_URL must be a redis:// or rediss:// endpoint with a host");
        }
        // Plaintext Redis is acceptable only when the traffic never leaves the private
        // network — a Compose/Kubernetes service name or a private address. Anything
        // routable on the public internet must be TLS, or the shared rate-limit counters
        // (and their HMAC-keyed bucket ids) travel in the clear.
        if ("redis".equalsIgnoreCase(redisScheme) && !isInNetworkHost(redisHost)) {
            throw new IllegalStateException(
                    "Plaintext redis:// is only allowed for an in-network host (service name or private address); "
                            + "a publicly routable endpoint requires managed TLS Redis (rediss://)");
        }
        if (properties.getHmacSecret() == null || properties.getHmacSecret().trim().length() < 32) {
            throw new IllegalStateException("The prod profile requires a 32+ character BIGBIKE_RATE_LIMIT_HMAC_SECRET");
        }
    }

    private boolean isProduction() {
        return Arrays.asList(environment.getActiveProfiles()).contains("prod");
    }

    /**
     * A bare service name (Compose/Kubernetes DNS) or a loopback/private literal stays inside the
     * deployment network. Names are judged without a DNS lookup so startup never depends on
     * resolver state.
     */
    private static boolean isInNetworkHost(String host) {
        String candidate = host.trim();
        if (candidate.startsWith("[") && candidate.endsWith("]")) {
            candidate = candidate.substring(1, candidate.length() - 1);
        }
        if (candidate.isEmpty()) {
            return false;
        }
        boolean ipv4Literal = IPV4_LITERAL.matcher(candidate).matches();
        boolean ipv6Literal = candidate.indexOf(':') >= 0;
        if (!ipv4Literal && !ipv6Literal) {
            // Single-label hostname such as "redis" resolves only inside the container network.
            return candidate.indexOf('.') < 0;
        }
        try {
            InetAddress parsed = InetAddress.getByName(candidate);
            return parsed.isLoopbackAddress()
                    || parsed.isSiteLocalAddress()
                    || parsed.isLinkLocalAddress()
                    || parsed.isAnyLocalAddress();
        } catch (UnknownHostException ex) {
            return false;
        }
    }
}
