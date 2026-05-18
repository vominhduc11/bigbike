package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.config.OAuthProperties;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Manual OAuth2 authorization-code flow for Google / Facebook social login.
 * Kept outside Spring Security's auto-wired chain so it composes cleanly with the
 * custom {@code CustomerSessionFilter} / STATELESS policy.
 */
@Service
@Slf4j
public class CustomerOAuthService {

    public static final Set<String> SUPPORTED_PROVIDERS = Set.of("google", "facebook");
    private static final String STATUS_ACTIVE = "ACTIVE";

    private final OAuthProperties props;
    private final CustomerJpaRepository customerRepo;
    private final RestClient http;

    public CustomerOAuthService(OAuthProperties props, CustomerJpaRepository customerRepo) {
        this.props = props;
        this.customerRepo = customerRepo;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(4_000);
        factory.setReadTimeout(8_000);
        this.http = RestClient.builder().requestFactory(factory).build();
    }

    public boolean isSupported(String provider) {
        return provider != null && SUPPORTED_PROVIDERS.contains(provider);
    }

    /** Builds the provider consent-screen URL the browser is redirected to. */
    public String buildAuthorizeUrl(String provider, String state) {
        OAuthProperties.Provider cfg = requireConfigured(provider);
        String redirectUri = redirectUri(provider);
        if ("google".equals(provider)) {
            return UriComponentsBuilder.fromUriString("https://accounts.google.com/o/oauth2/v2/auth")
                    .queryParam("client_id", cfg.getClientId())
                    .queryParam("redirect_uri", redirectUri)
                    .queryParam("response_type", "code")
                    .queryParam("scope", "openid email profile")
                    .queryParam("state", state)
                    .build().encode().toUriString();
        }
        return UriComponentsBuilder.fromUriString("https://www.facebook.com/v19.0/dialog/oauth")
                .queryParam("client_id", cfg.getClientId())
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "email,public_profile")
                .queryParam("state", state)
                .build().encode().toUriString();
    }

    /** Exchanges the authorization code for the provider profile. */
    public OAuthUserInfo exchangeCode(String provider, String code) {
        OAuthProperties.Provider cfg = requireConfigured(provider);
        String redirectUri = redirectUri(provider);
        return "google".equals(provider)
                ? exchangeGoogle(cfg, redirectUri, code)
                : exchangeFacebook(cfg, redirectUri, code);
    }

    private OAuthUserInfo exchangeGoogle(OAuthProperties.Provider cfg, String redirectUri, String code) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", cfg.getClientId());
        form.add("client_secret", cfg.getClientSecret());
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");

        Map<?, ?> token = http.post()
                .uri("https://oauth2.googleapis.com/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(Map.class);
        String accessToken = str(token, "access_token");
        if (accessToken == null) throw new OAuthException("Google token exchange failed.");

        Map<?, ?> profile = http.get()
                .uri("https://openidconnect.googleapis.com/v1/userinfo")
                .header("Authorization", "Bearer " + accessToken)
                .retrieve()
                .body(Map.class);
        String subject = str(profile, "sub");
        if (subject == null) throw new OAuthException("Google profile missing subject.");
        boolean emailVerified = Boolean.TRUE.equals(profile.get("email_verified"))
                || "true".equals(String.valueOf(profile.get("email_verified")));
        return new OAuthUserInfo(subject, str(profile, "email"), emailVerified, str(profile, "name"));
    }

    private OAuthUserInfo exchangeFacebook(OAuthProperties.Provider cfg, String redirectUri, String code) {
        Map<?, ?> token = http.get()
                .uri(UriComponentsBuilder.fromUriString("https://graph.facebook.com/v19.0/oauth/access_token")
                        .queryParam("client_id", cfg.getClientId())
                        .queryParam("client_secret", cfg.getClientSecret())
                        .queryParam("redirect_uri", redirectUri)
                        .queryParam("code", code)
                        .build().encode().toUri())
                .retrieve()
                .body(Map.class);
        String accessToken = str(token, "access_token");
        if (accessToken == null) throw new OAuthException("Facebook token exchange failed.");

        Map<?, ?> profile = http.get()
                .uri(UriComponentsBuilder.fromUriString("https://graph.facebook.com/v19.0/me")
                        .queryParam("fields", "id,name,email")
                        .queryParam("access_token", accessToken)
                        .build().encode().toUri())
                .retrieve()
                .body(Map.class);
        String subject = str(profile, "id");
        if (subject == null) throw new OAuthException("Facebook profile missing id.");
        // Facebook only returns an email when the user granted it; that email is provider-verified.
        String email = str(profile, "email");
        return new OAuthUserInfo(subject, email, email != null, str(profile, "name"));
    }

    /**
     * Resolves the customer behind a social profile:
     * reuse the linked account; else link onto an account with the same verified email;
     * else create a new active customer.
     */
    @Transactional
    public CustomerEntity linkOrCreate(String provider, OAuthUserInfo info) {
        Optional<CustomerEntity> linked =
                customerRepo.findByOauthProviderAndOauthSubject(provider, info.subject());
        if (linked.isPresent()) return linked.get();

        Instant now = Instant.now();
        // Only trust a provider email when the provider asserts it is verified — anti-takeover.
        String email = (info.emailVerified() && info.email() != null && !info.email().isBlank())
                ? info.email().toLowerCase(Locale.ROOT).trim()
                : null;

        if (email != null) {
            Optional<CustomerEntity> byEmail = customerRepo.findByEmail(email);
            if (byEmail.isPresent()) {
                CustomerEntity existing = byEmail.get();
                existing.setOauthProvider(provider);
                existing.setOauthSubject(info.subject());
                if (existing.getEmailVerifiedAt() == null) existing.setEmailVerifiedAt(now);
                existing.setLastLoginAt(now);
                existing.setUpdatedAt(now);
                return customerRepo.save(existing);
            }
        }

        CustomerEntity created = new CustomerEntity();
        created.setEmail(email);
        created.setDisplayName(info.displayName() != null && !info.displayName().isBlank()
                ? info.displayName() : "Khách BigBike");
        created.setStatus(STATUS_ACTIVE);
        created.setSynthetic(false);
        created.setOauthProvider(provider);
        created.setOauthSubject(info.subject());
        if (email != null) created.setEmailVerifiedAt(now);
        created.setLastLoginAt(now);
        created.setCreatedAt(now);
        created.setUpdatedAt(now);
        return customerRepo.save(created);
    }

    private OAuthProperties.Provider requireConfigured(String provider) {
        OAuthProperties.Provider cfg = props.provider(provider);
        if (cfg == null) throw new OAuthException("Unsupported OAuth provider: " + provider);
        if (!cfg.isConfigured()) throw new OAuthException("OAuth provider not configured: " + provider);
        return cfg;
    }

    private String redirectUri(String provider) {
        return props.getCallbackBaseUrl() + "/api/v1/customer/auth/oauth/" + provider + "/callback";
    }

    public String webSuccessUrl() {
        return props.getWebSuccessUrl();
    }

    private static String str(Map<?, ?> map, String key) {
        Object v = map == null ? null : map.get(key);
        return v == null ? null : v.toString();
    }

    /** Raised on any OAuth failure; the controller catches it and redirects to the error page. */
    public static class OAuthException extends RuntimeException {
        public OAuthException(String message) {
            super(message);
        }
    }
}
