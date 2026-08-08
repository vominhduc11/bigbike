package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.customer.dto.CustomerOAuthLinkResponse;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.config.CustomerAuthCookies;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerOAuthLinkEntity;
import com.bigbike.bigbike_backend.api.customer.dto.UpdateCustomerProfileRequest;
import com.bigbike.bigbike_backend.api.error.ForbiddenException;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerOAuthLinkJpaRepository;
import com.bigbike.bigbike_backend.service.customer.CustomerAuthService;
import com.bigbike.bigbike_backend.service.customer.CustomerOAuthService;
import com.bigbike.bigbike_backend.service.customer.OAuthUserInfo;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Social login (OAuth2). The provider round-trip itself cannot run here — no client id/secret is
 * configured in tests, which is exactly what makes the "unconfigured" and "cancelled" paths
 * testable end-to-end. Everything downstream of the provider (link-or-create, account adoption
 * rules, unlink guards) is driven through {@link CustomerOAuthService} directly.
 */
@SpringBootTest
class CustomerOAuthApiTest {

    private static final String AUTHORIZE = "/api/v1/customer/auth/oauth/%s/authorize";
    private static final String CALLBACK = "/api/v1/customer/auth/oauth/%s/callback";
    private static final String LINKS = "/api/v1/customer/auth/oauth/links";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CustomerOAuthService oauthService;
    @Autowired CustomerAuthService authService;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired CustomerOAuthLinkJpaRepository linkRepo;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── authorize ─────────────────────────────────────────────────────────────

    @Test
    void authorizeWithNoClientCredentialsSaysUnconfiguredRatherThanFailing() throws Exception {
        // Tests ship no OAUTH_* values, so both providers are "configured off".
        MvcResult result = mockMvc.perform(get(String.format(AUTHORIZE, "google")))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("/dang-nhap/?error=oauth_unconfigured");
    }

    @Test
    void authorizeForAnUnknownProviderIsRejected() throws Exception {
        MvcResult result = mockMvc.perform(get(String.format(AUTHORIZE, "twitter")))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("error=oauth_failed");
    }

    @Test
    void authorizeKeepsTheEnglishCustomerOnTheEnglishLoginPage() throws Exception {
        MvcResult result = mockMvc.perform(get(String.format(AUTHORIZE, "google")).param("tiep", "/en/account/"))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("/en/login/?error=");
        assertThat(redirect(result)).doesNotContain("/dang-nhap/");
    }

    @Test
    void authorizeRejectsAnOffsiteReturnDestination() throws Exception {
        // //evil.example is protocol-relative — it would leave the site entirely.
        MvcResult result = mockMvc.perform(get(String.format(AUTHORIZE, "google")).param("tiep", "//evil.example/"))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).doesNotContain("evil.example");
    }

    // ── callback ──────────────────────────────────────────────────────────────

    @Test
    void callbackWithoutCodeOrStateReportsCancelledNotAGenericFailure() throws Exception {
        MvcResult result = mockMvc.perform(get(String.format(CALLBACK, "google")))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("error=oauth_cancelled");
    }

    @Test
    void callbackWithProviderErrorReportsCancelled() throws Exception {
        MvcResult result = mockMvc.perform(get(String.format(CALLBACK, "google"))
                        .param("error", "access_denied")
                        .param("state", "whatever"))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("error=oauth_cancelled");
    }

    @Test
    void callbackWithAMismatchedStateIsRejected() throws Exception {
        MvcResult result = mockMvc.perform(get(String.format(CALLBACK, "google"))
                        .param("code", "any-code")
                        .param("state", "not-the-nonce")
                        .cookie(stateCookie("google", "the-real-nonce", "/tai-khoan/")))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("error=oauth_failed");
    }

    @Test
    void aStateIssuedForGoogleCannotBeReplayedAtTheFacebookCallback() throws Exception {
        MvcResult result = mockMvc.perform(get(String.format(CALLBACK, "facebook"))
                        .param("code", "any-code")
                        .param("state", "shared-nonce")
                        .cookie(stateCookie("google", "shared-nonce", "/tai-khoan/")))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("error=oauth_failed");
    }

    @Test
    void callbackFailureKeepsTheLocaleCarriedInTheStateCookie() throws Exception {
        MvcResult result = mockMvc.perform(get(String.format(CALLBACK, "google"))
                        .param("code", "any-code")
                        .param("state", "wrong")
                        .cookie(stateCookie("google", "right", "/en/account/")))
                .andExpect(status().is3xxRedirection())
                .andReturn();

        assertThat(redirect(result)).contains("/en/login/?error=");
    }

    // ── link-or-create ────────────────────────────────────────────────────────

    @Test
    void firstSocialLoginCreatesAnActiveCustomerWithTheProviderEmail() {
        String email = uniqueEmail("oauth-new");
        CustomerEntity created = oauthService.linkOrCreate("google", info("sub-" + email, email, true, "Nguyễn Văn A"));

        assertThat(created.getStatus()).isEqualTo("ACTIVE");
        assertThat(created.getEmail()).isEqualTo(email);
        assertThat(created.getEmailVerifiedAt()).isNotNull();
        assertThat(created.getPasswordHash()).isNull();
        assertThat(created.getDisplayName()).isEqualTo("Nguyễn Văn A");
        assertThat(linkRepo.findByProviderAndSubject("google", "sub-" + email)).isPresent();
    }

    @Test
    void signingInAgainReusesTheSameAccountAndRefreshesLastLogin() {
        String email = uniqueEmail("oauth-repeat");
        CustomerEntity first = oauthService.linkOrCreate("google", info("sub-" + email, email, true, "A"));
        Instant firstLogin = first.getLastLoginAt();

        CustomerEntity second = oauthService.linkOrCreate("google", info("sub-" + email, email, true, "A"));

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getLastLoginAt()).isNotNull();
        assertThat(second.getLastLoginAt()).isAfterOrEqualTo(firstLogin);
        assertThat(linkRepo.findByCustomerIdOrderByLinkedAtAsc(first.getId())).hasSize(1);
    }

    @Test
    void facebookWithoutAnEmailStillGetsAnAccount() {
        String subject = "fb-" + UUID.randomUUID();
        CustomerEntity created = oauthService.linkOrCreate("facebook", info(subject, null, false, null));

        assertThat(created.getEmail()).isNull();
        assertThat(created.getDisplayName()).isEqualTo("Khách BigBike");
        assertThat(linkRepo.findByProviderAndSubject("facebook", subject)).isPresent();
    }

    @Test
    void bothProvidersCanBeLinkedToOneAccountWithoutErasingEachOther() {
        String email = uniqueEmail("oauth-two");
        CustomerEntity viaGoogle = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));
        CustomerEntity viaFacebook = oauthService.linkOrCreate("facebook", info("f-" + email, email, true, "A"));

        assertThat(viaFacebook.getId()).isEqualTo(viaGoogle.getId());
        assertThat(linkRepo.findByCustomerIdOrderByLinkedAtAsc(viaGoogle.getId()))
                .extracting("provider")
                .containsExactlyInAnyOrder("google", "facebook");
    }

    @Test
    void anUnverifiedPasswordAccountIsNotAdoptedOnTheStrengthOfAProviderEmail() {
        String email = uniqueEmail("oauth-takeover");
        CustomerEntity victim = saveCustomer(email, "$argon2id$fake-hash", null, "ACTIVE");

        CustomerEntity result = oauthService.linkOrCreate("facebook", info("fb-sub-" + email, email, true, "Attacker"));

        assertThat(result.getId()).isNotEqualTo(victim.getId());
        assertThat(result.getEmail()).isNull(); // the address stays with its original owner
        assertThat(customerRepo.findById(victim.getId()).orElseThrow().getPasswordHash()).isNotNull();
    }

    @Test
    void aPasswordAccountIsNeverAdoptedEvenWithAVerifiedMatchingEmail() {
        // Password accounts and social accounts are deliberately separate identities
        // (owner decision 2026-08-07) — a matching, provider-verified email is no longer
        // enough to merge into a password account, unlike the pre-2026-08-07 behavior.
        String email = uniqueEmail("oauth-noadopt");
        CustomerEntity existing = saveCustomer(email, "$argon2id$fake-hash", Instant.now(), "ACTIVE");

        CustomerEntity result = oauthService.linkOrCreate("google", info("g-sub-" + email, email, true, "A"));

        assertThat(result.getId()).isNotEqualTo(existing.getId());
        assertThat(result.getEmail()).isNull(); // avoids colliding with the password account's email
        assertThat(linkRepo.findByCustomerIdAndProvider(existing.getId(), "google")).isEmpty();
        assertThat(linkRepo.findByCustomerIdAndProvider(result.getId(), "google")).isPresent();
    }

    @Test
    void repeatSocialLoginSyncsTheLatestNameAndAvatarFromTheProvider() {
        String email = uniqueEmail("oauth-sync");
        CustomerEntity first = oauthService.linkOrCreate(
                "google", new OAuthUserInfo("sub-" + email, email, true, "Old Name", "https://old.example/a.png"));
        assertThat(first.getDisplayName()).isEqualTo("Old Name");
        assertThat(first.getAvatarUrl()).isEqualTo("https://old.example/a.png");

        CustomerEntity second = oauthService.linkOrCreate(
                "google", new OAuthUserInfo("sub-" + email, email, true, "New Name", "https://new.example/b.png"));

        assertThat(second.getId()).isEqualTo(first.getId());
        assertThat(second.getDisplayName()).isEqualTo("New Name");
        assertThat(second.getAvatarUrl()).isEqualTo("https://new.example/b.png");
    }

    @Test
    void repeatSocialLoginClearsTheAvatarWhenTheProviderNoLongerReturnsOne() {
        String email = uniqueEmail("oauth-sync-clear");
        oauthService.linkOrCreate(
                "google", new OAuthUserInfo("sub-" + email, email, true, "A", "https://old.example/a.png"));

        CustomerEntity second = oauthService.linkOrCreate(
                "google", new OAuthUserInfo("sub-" + email, email, true, "A", null));

        assertThat(second.getAvatarUrl()).isNull();
    }

    @Test
    void aBlockedAccountCannotSignInWithSocialLogin() {
        String email = uniqueEmail("oauth-blocked");
        CustomerEntity created = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));
        created.setStatus("BLOCKED");
        customerRepo.save(created);

        assertThatThrownBy(() -> oauthService.linkOrCreate("google", info("g-" + email, email, true, "A")))
                .isInstanceOf(CustomerOAuthService.OAuthException.class)
                .hasMessageContaining("not active");
    }

    // ── oauth-managed profile lock ───────────────────────────────────────────────

    @Test
    void aSocialAccountIsFlaggedOauthManagedAndAPasswordAccountIsNot() {
        String email = uniqueEmail("oauth-flag");
        CustomerEntity social = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));
        assertThat(authService.getProfile(social.getId()).oauthManaged()).isTrue();

        CustomerEntity password = saveCustomer(uniqueEmail("pwd-flag"), "$argon2id$fake-hash", Instant.now(), "ACTIVE");
        assertThat(authService.getProfile(password.getId()).oauthManaged()).isFalse();
    }

    @Test
    void aSocialAccountCannotSelfEditItsProfile() {
        String email = uniqueEmail("oauth-lock-profile");
        CustomerEntity social = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));
        UpdateCustomerProfileRequest req =
                new UpdateCustomerProfileRequest("New Name", null, null, null, null, null, null);

        assertThatThrownBy(() -> authService.updateProfile(social.getId(), req))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void aSocialAccountCannotSelfManageItsAvatar() {
        String email = uniqueEmail("oauth-lock-avatar");
        CustomerEntity social = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));

        assertThatThrownBy(() -> authService.updateAvatar(social.getId(), null))
                .isInstanceOf(ForbiddenException.class);
        assertThatThrownBy(() -> authService.removeAvatar(social.getId()))
                .isInstanceOf(ForbiddenException.class);
    }

    // ── links panel ───────────────────────────────────────────────────────────

    @Test
    void listingLinksRequiresASignedInCustomer() throws Exception {
        mockMvc.perform(get(LINKS)).andExpect(status().isUnauthorized());
    }

    @Test
    void unlinkingRequiresASignedInCustomer() throws Exception {
        // The CSRF filter runs ahead of authentication, so a bare DELETE is stopped there (403)
        // rather than reaching the 401. Either way it never touches a link.
        mockMvc.perform(delete(LINKS + "/google"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("CSRF_INVALID"));
    }

    @Test
    void aSocialOnlyAccountCannotUnlinkItsOnlySignInMethod() {
        String email = uniqueEmail("oauth-last");
        CustomerEntity created = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));

        List<CustomerOAuthLinkResponse> links = oauthService.listLinks(created.getId());
        assertThat(links).hasSize(1);
        assertThat(links.get(0).canUnlink()).isFalse();

        assertThatThrownBy(() -> oauthService.unlink(created.getId(), "google"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("set a password first");
    }

    @Test
    void aSocialOnlyAccountWithTwoProvidersCanDropOne() {
        String email = uniqueEmail("oauth-drop");
        CustomerEntity created = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));
        oauthService.linkOrCreate("facebook", info("f-" + email, email, true, "A"));

        assertThat(oauthService.listLinks(created.getId())).allMatch(CustomerOAuthLinkResponse::canUnlink);

        oauthService.unlink(created.getId(), "google");

        assertThat(oauthService.listLinks(created.getId()))
                .extracting(CustomerOAuthLinkResponse::provider)
                .containsExactly("facebook");
        // The legacy mirror must not keep pointing at the link that was just removed.
        assertThat(customerRepo.findById(created.getId()).orElseThrow().getOauthProvider())
                .isEqualTo("facebook");
    }

    @Test
    void unlinkingAProviderThatWasNeverLinkedIs404() {
        String email = uniqueEmail("oauth-missing");
        CustomerEntity created = oauthService.linkOrCreate("google", info("g-" + email, email, true, "A"));

        assertThatThrownBy(() -> oauthService.unlink(created.getId(), "facebook"))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void aPasswordCustomerSeesTheirLinkAsRemovable() throws Exception {
        // A password account can no longer pick up a link via linkOrCreate (see
        // aPasswordAccountIsNeverAdoptedEvenWithAVerifiedMatchingEmail) — this models a
        // link that already existed before that rule change (owner decision: leave existing
        // grandfathered links alone), inserted directly rather than through the login flow.
        String email = uniqueEmail("oauth-panel");
        AuthSession session = registerAndLogin(email);
        CustomerEntity customer = customerRepo.findByEmail(email).orElseThrow();
        customer.setEmailVerifiedAt(Instant.now());
        customerRepo.save(customer);
        attachLegacyLink(customer.getId(), "google", "g-" + email);

        mockMvc.perform(get(LINKS).cookie(session.cookies()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].provider").value("google"))
                .andExpect(jsonPath("$.data[0].canUnlink").value(true));
    }

    @Test
    void unlinkingOverTheApiReturnsTheRemainingLinks() throws Exception {
        String email = uniqueEmail("oauth-unlink-api");
        AuthSession session = registerAndLogin(email);
        CustomerEntity customer = customerRepo.findByEmail(email).orElseThrow();
        customer.setEmailVerifiedAt(Instant.now());
        customerRepo.save(customer);
        attachLegacyLink(customer.getId(), "google", "g-" + email);

        mockMvc.perform(delete(LINKS + "/google")
                        .cookie(session.cookies()).header("X-CSRF-Token", session.csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isEmpty());
    }

    @Test
    void unlinkingWithoutTheCsrfHeaderIsRejected() throws Exception {
        String email = uniqueEmail("oauth-unlink-csrf");
        AuthSession session = registerAndLogin(email);

        mockMvc.perform(delete(LINKS + "/google").cookie(session.cookies()))
                .andExpect(status().isForbidden());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private static String redirect(MvcResult result) {
        return String.valueOf(result.getResponse().getRedirectedUrl());
    }

    private static OAuthUserInfo info(String subject, String email, boolean verified, String displayName) {
        return new OAuthUserInfo(subject, email, verified, displayName, null);
    }

    private static String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@bigbike.vn";
    }

    /** Mirrors what {@code authorize} writes: {@code provider|nonce|base64url(returnTo)}. */
    private static Cookie stateCookie(String provider, String nonce, String returnTo) {
        String encoded = java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(returnTo.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return new Cookie(CustomerAuthCookies.COOKIE_OAUTH_STATE, provider + "|" + nonce + "|" + encoded);
    }

    /** Inserts a link row directly — models a pre-existing/grandfathered link without going
     *  through {@link CustomerOAuthService#linkOrCreate}, which no longer attaches social
     *  identities to password accounts. */
    private void attachLegacyLink(UUID customerId, String provider, String subject) {
        CustomerOAuthLinkEntity link = new CustomerOAuthLinkEntity();
        link.setCustomerId(customerId);
        link.setProvider(provider);
        link.setSubject(subject);
        link.setLinkedAt(Instant.now());
        linkRepo.save(link);
    }

    private CustomerEntity saveCustomer(String email, String passwordHash, Instant emailVerifiedAt, String status) {
        CustomerEntity c = new CustomerEntity();
        c.setEmail(email);
        c.setPasswordHash(passwordHash);
        c.setEmailVerifiedAt(emailVerifiedAt);
        c.setDisplayName("Existing");
        c.setStatus(status);
        c.setSynthetic(false);
        c.setCreatedAt(Instant.now());
        c.setUpdatedAt(Instant.now());
        return customerRepo.save(c);
    }

    private AuthSession registerAndLogin(String email) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk());
        MvcResult login = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return new AuthSession(login.getResponse().getCookies(),
                cookieValue(login.getResponse(), CustomerAuthCookies.COOKIE_CSRF));
    }

    private static String cookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName()) && !c.getValue().isEmpty()) return c.getValue();
        }
        return null;
    }

    private record AuthSession(Cookie[] cookies, String csrf) {}
}
