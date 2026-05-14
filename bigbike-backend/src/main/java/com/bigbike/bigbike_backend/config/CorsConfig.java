package com.bigbike.bigbike_backend.config;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class CorsConfig {

    private static final Set<String> DEV_PROFILES = Set.of("dev", "mock", "test", "local");

    @Value("${bigbike.cors.allowed-origins:http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:4001}")
    private String allowedOriginsRaw;

    private final Environment environment;

    public CorsConfig(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    void validateOrigins() {
        Set<String> activeProfiles = Arrays.stream(environment.getActiveProfiles())
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        boolean isDevProfile = activeProfiles.isEmpty()
                || activeProfiles.stream().anyMatch(DEV_PROFILES::contains);
        if (isDevProfile) {
            return;
        }

        List<String> origins = parseOrigins();
        if (origins.isEmpty()) {
            throw new IllegalStateException(
                    "CORS_ALLOWED_ORIGINS must be set in non-dev profiles. "
                    + "Example: https://bigbike.vn,https://www.bigbike.vn");
        }
        for (String origin : origins) {
            if (origin.equals("*")) {
                throw new IllegalStateException(
                        "CORS_ALLOWED_ORIGINS must not use wildcard '*' in non-dev profiles.");
            }
            if (origin.contains("localhost") || origin.contains("127.0.0.1")) {
                throw new IllegalStateException(
                        "CORS_ALLOWED_ORIGINS must not contain localhost or 127.0.0.1 in non-dev profiles. "
                        + "Found: " + origin);
            }
        }
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(parseOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Location", "Content-Disposition"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/**", config);
        return source;
    }

    private List<String> parseOrigins() {
        return Arrays.stream(allowedOriginsRaw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
