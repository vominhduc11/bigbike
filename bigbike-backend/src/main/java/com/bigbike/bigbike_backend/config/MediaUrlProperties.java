package com.bigbike.bigbike_backend.config;

import jakarta.annotation.PostConstruct;
import java.net.URI;
import java.net.URISyntaxException;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "bigbike.media")
public class MediaUrlProperties {

    private static final String DEFAULT_PUBLIC_BASE_URL = "http://localhost:9000/bigbike-media";

    private String publicBaseUrl = DEFAULT_PUBLIC_BASE_URL;

    @PostConstruct
    void validate() {
        publicBaseUrl = normalize(publicBaseUrl);
        if (publicBaseUrl == null) {
            publicBaseUrl = DEFAULT_PUBLIC_BASE_URL;
        }

        try {
            URI uri = new URI(publicBaseUrl);
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) {
                throw new IllegalStateException("bigbike.media.public-base-url must be an absolute http(s) URL.");
            }
            String lowerScheme = scheme.toLowerCase();
            if (!"http".equals(lowerScheme) && !"https".equals(lowerScheme)) {
                throw new IllegalStateException("bigbike.media.public-base-url must use http or https.");
            }
            if (uri.getPath() == null || uri.getPath().isBlank()) {
                throw new IllegalStateException("bigbike.media.public-base-url must include the public bucket/path prefix.");
            }
        } catch (URISyntaxException e) {
            throw new IllegalStateException("bigbike.media.public-base-url is invalid: " + e.getMessage(), e);
        }
    }

    public String getPublicBaseUrl() {
        return publicBaseUrl;
    }

    public void setPublicBaseUrl(String publicBaseUrl) {
        this.publicBaseUrl = publicBaseUrl;
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.isEmpty()) {
            return null;
        }
        while (normalized.endsWith("/") && normalized.length() > 1) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }
}
