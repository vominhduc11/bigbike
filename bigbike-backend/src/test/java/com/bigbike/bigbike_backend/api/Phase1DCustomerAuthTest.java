package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerSessionEntity;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerSessionJpaRepository;
import jakarta.servlet.http.Cookie;
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

@SpringBootTest
class Phase1DCustomerAuthTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired CustomerJpaRepository customerRepo;
    @Autowired CustomerSessionJpaRepository sessionRepo;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── registration ──────────────────────────────────────────────────────────

    @Test
    void register_withEmail_creates_customer_and_sets_cookies() throws Exception {
        String email = "test-" + UUID.randomUUID() + "@bigbike.vn";
        MvcResult result = mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customer.email").value(email))
                .andExpect(jsonPath("$.data.csrfToken").isNotEmpty())
                .andReturn();

        assertCookieSet(result.getResponse(), "bb_session", true);
        assertCookieSet(result.getResponse(), "bb_refresh", true);
        assertCookieSet(result.getResponse(), "bb_csrf", false);
        assertThat(customerRepo.findByEmail(email)).isPresent();
    }

    @Test
    void register_withPhone_creates_customer() throws Exception {
        String phone = "09" + (int)(Math.random() * 100000000);
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"" + phone + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customer.phone").value(phone));
        assertThat(customerRepo.findByPhone(phone)).isPresent();
    }

    @Test
    void register_withoutEmailOrPhone_returns_400() throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"secret123\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void register_passwordTooShort_returns_400() throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"short@bigbike.vn\",\"password\":\"abc\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void register_duplicateEmail_returns_409() throws Exception {
        String email = "dup-" + UUID.randomUUID() + "@bigbike.vn";
        String body = "{\"email\":\"" + email + "\",\"password\":\"secret123\"}";
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    // ── login ────────────────────────────────────────────────────────────────

    @Test
    void login_withEmail_succeeds_and_sets_cookies() throws Exception {
        String email = "login-" + UUID.randomUUID() + "@bigbike.vn";
        registerCustomer(email, null, "pass1234");

        MvcResult result = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customer.email").value(email))
                .andReturn();

        assertCookieSet(result.getResponse(), "bb_session", true);
        assertCookieSet(result.getResponse(), "bb_refresh", true);
        assertCookieSet(result.getResponse(), "bb_csrf", false);
    }

    @Test
    void login_withPhone_succeeds() throws Exception {
        String phone = "09" + (int)(Math.random() * 100000000);
        registerCustomer(null, phone, "pass1234");

        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + phone + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.customer.phone").value(phone));
    }

    @Test
    void login_wrongPassword_returns_401() throws Exception {
        String email = "badpw-" + UUID.randomUUID() + "@bigbike.vn";
        registerCustomer(email, null, "correctpassword");

        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"wrongpassword\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    void login_unknownUser_returns_401_without_timing_shortcut() throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"nobody@nowhere.com\",\"password\":\"anything\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ── session cookie auth ───────────────────────────────────────────────────

    @Test
    void session_cookie_authenticates_me_endpoint() throws Exception {
        String email = "me-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = loginAndGetCookies(email, "pass1234");

        mockMvc.perform(get("/api/v1/customer/me").cookie(cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.email").value(email));
    }

    @Test
    void me_withoutSession_returns_401() throws Exception {
        mockMvc.perform(get("/api/v1/customer/me"))
                .andExpect(status().isUnauthorized());
    }

    // ── CSRF ────────────────────────────────────────────────────────────────

    @Test
    void csrf_protects_logout_without_header() throws Exception {
        String email = "csrf-" + UUID.randomUUID() + "@bigbike.vn";
        Cookie[] cookies = loginAndGetCookies(email, "pass1234");

        mockMvc.perform(post("/api/v1/customer/auth/logout").cookie(cookies))
                .andExpect(status().isForbidden());
    }

    @Test
    void csrf_allows_logout_with_correct_header() throws Exception {
        String email = "csrfok-" + UUID.randomUUID() + "@bigbike.vn";
        MvcResult loginResult = performLogin(email, "pass1234");
        Cookie[] cookies = loginResult.getResponse().getCookies();
        String csrfValue = getCookieValue(loginResult.getResponse(), "bb_csrf");

        mockMvc.perform(post("/api/v1/customer/auth/logout")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrfValue))
                .andExpect(status().isOk());
    }

    @Test
    void csrf_exempts_register_endpoint() throws Exception {
        String email = "nocsrf-" + UUID.randomUUID() + "@bigbike.vn";
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void csrf_exempts_login_endpoint() throws Exception {
        String email = "nocsrflogin-" + UUID.randomUUID() + "@bigbike.vn";
        registerCustomer(email, null, "secret123");
        mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk());
    }

    // ── refresh ───────────────────────────────────────────────────────────────

    @Test
    void refresh_with_valid_token_rotates_session() throws Exception {
        String email = "refresh-" + UUID.randomUUID() + "@bigbike.vn";
        MvcResult loginResult = performLogin(email, "pass1234");
        Cookie refreshCookie = getNamedCookie(loginResult.getResponse(), "bb_refresh");
        assertThat(refreshCookie).isNotNull();

        MvcResult refreshResult = mockMvc.perform(post("/api/v1/customer/auth/refresh")
                        .cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.csrfToken").isNotEmpty())
                .andReturn();

        // New bb_session cookie must differ from old one
        Cookie newSession = getNamedCookie(refreshResult.getResponse(), "bb_session");
        Cookie oldSession = getNamedCookie(loginResult.getResponse(), "bb_session");
        assertThat(newSession).isNotNull();
        assertThat(newSession.getValue()).isNotEqualTo(oldSession.getValue());
    }

    @Test
    void refresh_without_cookie_returns_401() throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/refresh"))
                .andExpect(status().isUnauthorized());
    }

    // ── logout ────────────────────────────────────────────────────────────────

    @Test
    void logout_revokes_session_in_db() throws Exception {
        String email = "revoke-" + UUID.randomUUID() + "@bigbike.vn";
        MvcResult loginResult = performLogin(email, "pass1234");
        Cookie[] cookies = loginResult.getResponse().getCookies();
        String csrfValue = getCookieValue(loginResult.getResponse(), "bb_csrf");
        String sessionValue = getCookieValue(loginResult.getResponse(), "bb_session");

        mockMvc.perform(post("/api/v1/customer/auth/logout")
                        .cookie(cookies)
                        .header("X-CSRF-Token", csrfValue))
                .andExpect(status().isOk());

        // Session hash must now be REVOKED
        com.bigbike.bigbike_backend.service.auth.JwtService jwtService =
                webApplicationContext.getBean(com.bigbike.bigbike_backend.service.auth.JwtService.class);
        String hash = jwtService.hashToken(sessionValue);
        assertThat(sessionRepo.findBySessionTokenHash(hash))
                .isPresent()
                .get()
                .extracting(CustomerSessionEntity::getStatus)
                .isEqualTo("REVOKED");
    }

    // ── regression ───────────────────────────────────────────────────────────

    @Test
    void regression_adminEndpointStillRequires401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void regression_publicCatalogStillPublic() throws Exception {
        mockMvc.perform(get("/api/v1/products").param("page", "1").param("size", "2"))
                .andExpect(status().isOk());
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    private void registerCustomer(String email, String phone, String password) throws Exception {
        StringBuilder body = new StringBuilder("{");
        if (email != null) body.append("\"email\":\"").append(email).append("\",");
        if (phone != null) body.append("\"phone\":\"").append(phone).append("\",");
        body.append("\"password\":\"").append(password).append("\"}");
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body.toString()))
                .andExpect(status().isOk());
    }

    private MvcResult performLogin(String email, String password) throws Exception {
        registerCustomer(email, null, password);
        return mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    private Cookie[] loginAndGetCookies(String email, String password) throws Exception {
        return performLogin(email, password).getResponse().getCookies();
    }

    private void assertCookieSet(MockHttpServletResponse response, String name, boolean httpOnly) {
        Cookie cookie = getNamedCookie(response, name);
        assertThat(cookie).as("Cookie '%s' should be set", name).isNotNull();
        assertThat(cookie.isHttpOnly()).as("Cookie '%s' httpOnly should be %s", name, httpOnly).isEqualTo(httpOnly);
    }

    private Cookie getNamedCookie(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c;
        }
        return null;
    }

    private String getCookieValue(MockHttpServletResponse response, String name) {
        Cookie cookie = getNamedCookie(response, name);
        return cookie != null ? cookie.getValue() : null;
    }
}
