package com.bigbike.bigbike_backend.service.customer;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerOAuthLinkResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.config.OAuthProperties;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerOAuthLinkEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerOAuthLinkJpaRepository;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
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
    private final CustomerOAuthLinkJpaRepository linkRepo;
    private final GuestOrderLinkingService guestOrderLinkingService;
    private final RestClient http;

    public CustomerOAuthService(OAuthProperties props, CustomerJpaRepository customerRepo,
            CustomerOAuthLinkJpaRepository linkRepo, GuestOrderLinkingService guestOrderLinkingService) {
        this.props = props;
        this.customerRepo = customerRepo;
        this.linkRepo = linkRepo;
        this.guestOrderLinkingService = guestOrderLinkingService;
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
        // auth_type=rerequest: without it, Facebook silently reuses whatever the customer granted
        // on a PRIOR authorization of this app and skips the consent screen entirely. Our app only
        // got App Review approval for the `email` permission after go-live, so every customer who
        // logged in before that date is now permanently stuck on their earlier public_profile-only
        // grant unless we force the dialog to re-ask.
        return UriComponentsBuilder.fromUriString("https://www.facebook.com/v19.0/dialog/oauth")
                .queryParam("client_id", cfg.getClientId())
                .queryParam("redirect_uri", redirectUri)
                .queryParam("response_type", "code")
                .queryParam("scope", "email,public_profile")
                .queryParam("auth_type", "rerequest")
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
        return new OAuthUserInfo(
                subject, str(profile, "email"), emailVerified, str(profile, "name"), str(profile, "picture"));
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

        // appsecret_proof binds the call to our app secret, so a stolen access token alone cannot
        // be replayed against the Graph API from elsewhere (Facebook's recommended hardening).
        Map<?, ?> profile = http.get()
                .uri(UriComponentsBuilder.fromUriString("https://graph.facebook.com/v19.0/me")
                        .queryParam("fields", "id,name,email,picture.type(large)")
                        .queryParam("access_token", accessToken)
                        .queryParam("appsecret_proof", appSecretProof(cfg.getClientSecret(), accessToken))
                        .build().encode().toUri())
                .retrieve()
                .body(Map.class);
        // TEMP DIAGNOSTIC: remove after reproducing Facebook's email behavior.
        log.warn("TEMP DIAGNOSTIC Facebook profile fields: {}", profile == null ? Set.of() : profile.keySet());
        try {
            Map<?, ?> permissions = http.get()
                    .uri(UriComponentsBuilder.fromUriString("https://graph.facebook.com/v19.0/me/permissions")
                            .queryParam("access_token", accessToken)
                            .queryParam("appsecret_proof", appSecretProof(cfg.getClientSecret(), accessToken))
                            .build().encode().toUri())
                    .retrieve()
                    .body(Map.class);
            log.warn("TEMP DIAGNOSTIC Facebook permissions: {}",
                    permissions == null ? null : permissions.get("data"));
        } catch (RuntimeException ex) {
            log.warn("TEMP DIAGNOSTIC Facebook permissions lookup failed: {}", ex.getClass().getSimpleName());
        }
        String subject = str(profile, "id");
        if (subject == null) throw new OAuthException("Facebook profile missing id.");
        // Facebook only returns an email when the user granted it; that email is provider-verified.
        String email = str(profile, "email");
        return new OAuthUserInfo(subject, email, email != null, str(profile, "name"), facebookPictureUrl(profile));
    }

    /**
     * Extracts {@code picture.data.url} from a Facebook Graph API profile. Facebook sets
     * {@code is_silhouette = true} when the account has no real photo — that generated placeholder
     * would look worse than our own initials badge, so it is treated as "no avatar".
     */
    private static String facebookPictureUrl(Map<?, ?> profile) {
        Object picture = profile == null ? null : profile.get("picture");
        if (!(picture instanceof Map<?, ?> pictureMap)) return null;
        Object data = pictureMap.get("data");
        if (!(data instanceof Map<?, ?> dataMap)) return null;
        if (Boolean.TRUE.equals(dataMap.get("is_silhouette"))) return null;
        Object url = dataMap.get("url");
        return url == null ? null : url.toString();
    }

    /**
     * Resolves the customer behind a social profile:
     * reuse the linked account; else link onto another OAuth-only account with the same verified
     * email (Google ↔ Facebook can still merge this way); else create a new active customer.
     * A password account is <b>never</b> adopted, even with a matching verified email — password
     * accounts and social accounts are deliberately separate identities (owner decision
     * 2026-08-07, BUSINESS_RULES.md CUSTOMER_RULE_010): a customer's profile is either
     * self-managed (password account) or provider-managed (social account), never both.
     */
    @Transactional
    public CustomerEntity linkOrCreate(String provider, OAuthUserInfo info) {
        Instant now = Instant.now();

        Optional<CustomerOAuthLinkEntity> link = linkRepo.findByProviderAndSubject(provider, info.subject());
        if (link.isPresent()) {
            CustomerEntity customer = customerRepo.findById(link.get().getCustomerId())
                    .orElseThrow(() -> new OAuthException("Linked customer no longer exists."));
            return touchLogin(customer, info, now);
        }

        // Only trust a provider email when the provider asserts it is verified — anti-takeover.
        String email = (info.emailVerified() && info.email() != null && !info.email().isBlank())
                ? info.email().toLowerCase(Locale.ROOT).trim()
                : null;

        if (email != null) {
            Optional<CustomerEntity> byEmail = customerRepo.findByEmail(email);
            if (byEmail.isPresent()) {
                CustomerEntity existing = byEmail.get();
                if (existing.getPasswordHash() == null) {
                    addLink(existing, provider, info.subject(), now);
                    // This provider just proved ownership of the address — mark it verified if a
                    // prior passwordless login (e.g. a migrated/synthetic account) never was, so
                    // guest-order auto-linking in touchLogin can pick up matching guest orders.
                    if (existing.getEmailVerifiedAt() == null) existing.setEmailVerifiedAt(now);
                    return touchLogin(existing, info, now);
                }
                // The matched account has a password — it is a self-managed identity, never
                // adopted by a social login regardless of email-verification state. Fall through
                // and create a separate account; the email stays with its password-account owner.
                // (Known trade-off: if that same email is later used to log in with the OTHER
                // social provider too, it will likewise fail to match this row — since we null
                // the email below to avoid the unique-index collision — and end up as a THIRD,
                // still-separate account instead of merging with this one. Accepted narrow edge
                // case; see DATA_CONTRACT.md customer_oauth_links section.)
                email = null;
            }
        }

        CustomerEntity created = new CustomerEntity();
        created.setEmail(email);
        created.setStatus(STATUS_ACTIVE);
        created.setSynthetic(false);
        if (email != null) created.setEmailVerifiedAt(now);
        created.setLastLoginAt(now);
        created.setCreatedAt(now);
        created.setUpdatedAt(now);
        syncProfileFromProvider(created, info);
        CustomerEntity saved = customerRepo.save(created);
        addLink(saved, provider, info.subject(), now);
        if (saved.getEmailVerifiedAt() != null) {
            guestOrderLinkingService.linkVerifiedEmailOrders(saved.getId());
        }
        return saved;
    }

    /**
     * Mirrors the provider's current name + photo onto the customer, overwriting whatever was
     * there before. Called on every OAuth login (creation, first link, and every repeat login) —
     * a social-account customer's profile has no self-service edit path (BUSINESS_RULES.md
     * CUSTOMER_RULE_010), so this IS the update mechanism: change it on Google/Facebook, it syncs
     * here next sign-in. The photo is stored as a direct hotlink to the provider's own CDN, not
     * re-uploaded to MinIO — owner-approved exception (2026-08-07) to the project's MinIO-only
     * media rule, scoped to this field only.
     */
    private void syncProfileFromProvider(CustomerEntity customer, OAuthUserInfo info) {
        if (info.displayName() != null && !info.displayName().isBlank()) {
            customer.setDisplayName(info.displayName());
        } else if (customer.getDisplayName() == null) {
            customer.setDisplayName("Khách BigBike");
        }
        customer.setAvatarUrl(
                info.avatarUrl() != null && info.avatarUrl().startsWith("https://") ? info.avatarUrl() : null);
    }

    private CustomerEntity touchLogin(CustomerEntity customer, OAuthUserInfo info, Instant now) {
        requireActive(customer);
        syncProfileFromProvider(customer, info);
        backfillEmailIfMissing(customer, info, now);
        customer.setLastLoginAt(now);
        customer.setUpdatedAt(now);
        CustomerEntity saved = customerRepo.save(customer);
        // Same courtesy password login does: adopt orders placed as a guest with this address
        // before the account existed. Idempotent — already-linked orders are skipped.
        if (saved.getEmailVerifiedAt() != null) {
            guestOrderLinkingService.linkVerifiedEmailOrders(saved.getId());
        }
        return saved;
    }

    /**
     * Adopts a provider email on a repeat login for a customer that was created without one —
     * e.g. Facebook only got App Review approval for the {@code email} permission after this
     * customer's first login, so the original account was created with {@code email = null} and
     * would otherwise stay that way forever. Same anti-takeover rule as account creation: never
     * steal an email already owned by a *different* customer.
     */
    private void backfillEmailIfMissing(CustomerEntity customer, OAuthUserInfo info, Instant now) {
        if (customer.getEmailVerifiedAt() != null) return;
        if (!info.emailVerified() || info.email() == null || info.email().isBlank()) return;
        String email = info.email().toLowerCase(Locale.ROOT).trim();
        Optional<CustomerEntity> existing = customerRepo.findByEmail(email);
        if (existing.isPresent() && !existing.get().getId().equals(customer.getId())) return;
        customer.setEmail(email);
        customer.setEmailVerifiedAt(now);
    }

    private static void requireActive(CustomerEntity customer) {
        if (!STATUS_ACTIVE.equals(customer.getStatus())) {
            // Password login rejects non-ACTIVE accounts too. Without this the callback happily
            // issued a session that CustomerSessionFilter then refuses, leaving the customer in a
            // "logged in but logged out" loop with nothing on screen explaining why.
            throw new OAuthException(OAuthError.BLOCKED, "Customer account is not active.");
        }
    }

    /**
     * Records the identity in {@code customer_oauth_links} and mirrors it onto the legacy V129
     * columns, which some read paths still consult. Adding a second provider no longer erases
     * the first — the unique index is per (customer, provider).
     */
    private void addLink(CustomerEntity customer, String provider, String subject, Instant now) {
        CustomerOAuthLinkEntity link = new CustomerOAuthLinkEntity();
        link.setCustomerId(customer.getId());
        link.setProvider(provider);
        link.setSubject(subject);
        link.setLinkedAt(now);
        linkRepo.save(link);

        customer.setOauthProvider(provider);
        customer.setOauthSubject(subject);
    }

    /** Social identities currently linked to a customer, oldest first. */
    @Transactional(readOnly = true)
    public List<CustomerOAuthLinkResponse> listLinks(UUID customerId) {
        boolean hasPassword = customerRepo.findById(customerId)
                .map(c -> c.getPasswordHash() != null)
                .orElse(false);
        List<CustomerOAuthLinkEntity> links = linkRepo.findByCustomerIdOrderByLinkedAtAsc(customerId);
        boolean isLastLink = links.size() <= 1;
        return links.stream()
                .map(l -> new CustomerOAuthLinkResponse(
                        l.getProvider(), l.getLinkedAt(), hasPassword || !isLastLink))
                .toList();
    }

    /**
     * Removes one social identity. Refuses to remove the last one when the account has no
     * password, which would lock the customer out of their own account for good.
     */
    @Transactional
    public void unlink(UUID customerId, String provider) {
        CustomerEntity customer = customerRepo.findById(customerId)
                .orElseThrow(() -> new NotFoundException("Customer not found."));
        CustomerOAuthLinkEntity link = linkRepo.findByCustomerIdAndProvider(customerId, provider)
                .orElseThrow(() -> new NotFoundException("No linked account for provider: " + provider));

        if (customer.getPasswordHash() == null && linkRepo.countByCustomerId(customerId) <= 1) {
            throw new ConflictException(
                    "Cannot unlink the only sign-in method; set a password first.");
        }

        linkRepo.delete(link);
        if (provider.equals(customer.getOauthProvider())) {
            // Keep the legacy mirror pointing at a link that still exists.
            List<CustomerOAuthLinkEntity> remaining = linkRepo.findByCustomerIdOrderByLinkedAtAsc(customerId);
            CustomerOAuthLinkEntity next = remaining.isEmpty() ? null : remaining.get(0);
            customer.setOauthProvider(next == null ? null : next.getProvider());
            customer.setOauthSubject(next == null ? null : next.getSubject());
            customer.setUpdatedAt(Instant.now());
            customerRepo.save(customer);
        }
    }

    private OAuthProperties.Provider requireConfigured(String provider) {
        OAuthProperties.Provider cfg = props.provider(provider);
        if (cfg == null) throw new OAuthException("Unsupported OAuth provider: " + provider);
        if (!cfg.isConfigured()) {
            throw new OAuthException(OAuthError.UNCONFIGURED, "OAuth provider not configured: " + provider);
        }
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

    /** HMAC-SHA256 of the access token, keyed by the app secret, hex-encoded. */
    private static String appSecretProof(String appSecret, String accessToken) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(appSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(accessToken.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (GeneralSecurityException ex) {
            throw new OAuthException("Cannot compute Facebook appsecret_proof.");
        }
    }

    /** Raised on any OAuth failure; the controller catches it and redirects to the error page. */
    public static class OAuthException extends RuntimeException {

        private final OAuthError error;

        public OAuthException(String message) {
            this(OAuthError.FAILED, message);
        }

        public OAuthException(OAuthError error, String message) {
            super(message);
            this.error = error;
        }

        public OAuthError getError() {
            return error;
        }
    }

}
