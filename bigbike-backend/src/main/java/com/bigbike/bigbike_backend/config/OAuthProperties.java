package com.bigbike.bigbike_backend.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Social login (OAuth2) configuration — bound from {@code bigbike.oauth.*}.
 * Client id/secret blank → that provider is effectively disabled (the flow returns an error).
 */
@Component
@ConfigurationProperties("bigbike.oauth")
@Getter
@Setter
public class OAuthProperties {

    private Provider google = new Provider();
    private Provider facebook = new Provider();

    /** Backend base URL the providers redirect their callbacks to. */
    private String callbackBaseUrl = "http://localhost:8080";

    /** Storefront URL the callback redirects the browser to after login. */
    private String webSuccessUrl = "http://localhost:3000";

    @Getter
    @Setter
    public static class Provider {
        private String clientId = "";
        private String clientSecret = "";

        public boolean isConfigured() {
            return clientId != null && !clientId.isBlank()
                    && clientSecret != null && !clientSecret.isBlank();
        }
    }

    public Provider provider(String name) {
        return "google".equals(name) ? google
                : "facebook".equals(name) ? facebook
                : null;
    }
}
