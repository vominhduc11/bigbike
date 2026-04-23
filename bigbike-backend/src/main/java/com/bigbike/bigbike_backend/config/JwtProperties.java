package com.bigbike.bigbike_backend.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
@ConfigurationProperties(prefix = "bigbike.jwt")
public class JwtProperties {

    private static final String DEFAULT_SECRET = "dev-change-me-in-production-needs-32chars!!";
    private static final Set<String> DEV_PROFILES = Set.of("dev", "mock", "test", "local");
    private static final int MIN_SECRET_LENGTH = 32;

    private String secret = DEFAULT_SECRET;
    private int accessTokenTtlSeconds = 900;
    private int refreshTokenTtlSeconds = 604800;

    private final Environment environment;

    public JwtProperties(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    void validateSecret() {
        Set<String> activeProfiles = Arrays.stream(environment.getActiveProfiles())
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        boolean isDevProfile = activeProfiles.isEmpty()
                || activeProfiles.stream().anyMatch(DEV_PROFILES::contains);
        if (isDevProfile) {
            return;
        }

        if (DEFAULT_SECRET.equals(secret)) {
            throw new IllegalStateException(
                    "BIGBIKE_JWT_SECRET must be changed from the default value in non-dev profiles. "
                    + "Set a random secret of at least " + MIN_SECRET_LENGTH + " characters.");
        }
        if (secret == null || secret.length() < MIN_SECRET_LENGTH) {
            throw new IllegalStateException(
                    "BIGBIKE_JWT_SECRET must be at least " + MIN_SECRET_LENGTH
                    + " characters long. Current length: " + (secret == null ? 0 : secret.length()));
        }
    }

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }

    public int getAccessTokenTtlSeconds() { return accessTokenTtlSeconds; }
    public void setAccessTokenTtlSeconds(int v) { this.accessTokenTtlSeconds = v; }

    public int getRefreshTokenTtlSeconds() { return refreshTokenTtlSeconds; }
    public void setRefreshTokenTtlSeconds(int v) { this.refreshTokenTtlSeconds = v; }
}
