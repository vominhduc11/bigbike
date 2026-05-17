package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
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

/**
 * RBAC / IDOR regression guard — see docs/audits/PERMISSION_RBAC_AUDIT.md.
 *
 * Runs under the shared test profile, where bigbike.auth.dev-header-enabled=true.
 * The customer-cannot-reach-admin assertion is therefore meaningful: it proves the
 * audit F1 (URL-layer role guard) and F2 (dev-header bypass no longer fires for a
 * non-admin principal) fixes hold even with the dev header enabled.
 */
@SpringBootTest
class RbacSecurityTest {

    @Autowired private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── Admin endpoints reject non-admin principals ──────────────────────────

    @Test
    void noTokenCannotReachAdminEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerSessionCannotReachAdminEndpoint() throws Exception {
        Cookie[] cookies = registerAndLogin("rbac-cust-" + UUID.randomUUID() + "@bigbike.vn");

        // A logged-in customer (ROLE_CUSTOMER) is rejected at the URL-layer role guard.
        mockMvc.perform(get("/api/v1/admin/products").cookie(cookies))
                .andExpect(status().isForbidden());
    }

    // ── IDOR: a customer cannot touch another customer's address ─────────────

    @Test
    void customerCannotUpdateAnotherCustomersAddress() throws Exception {
        Session a = login("rbac-a-" + UUID.randomUUID() + "@bigbike.vn");
        UUID addressId = createAddress(a, "Khach A");

        Session b = login("rbac-b-" + UUID.randomUUID() + "@bigbike.vn");
        mockMvc.perform(patch("/api/v1/customer/addresses/" + addressId)
                        .cookie(b.cookies)
                        .header("X-CSRF-Token", b.csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addressBody("Hacked By B")))
                .andExpect(status().isNotFound());
    }

    @Test
    void customerCannotDeleteAnotherCustomersAddress() throws Exception {
        Session a = login("rbac-da-" + UUID.randomUUID() + "@bigbike.vn");
        UUID addressId = createAddress(a, "Khach A");

        Session b = login("rbac-db-" + UUID.randomUUID() + "@bigbike.vn");
        mockMvc.perform(delete("/api/v1/customer/addresses/" + addressId)
                        .cookie(b.cookies)
                        .header("X-CSRF-Token", b.csrf))
                .andExpect(status().isNotFound());
    }

    @Test
    void customerAddressListIsScopedToOwner() throws Exception {
        Session a = login("rbac-la-" + UUID.randomUUID() + "@bigbike.vn");
        UUID addressId = createAddress(a, "Khach A");

        Session b = login("rbac-lb-" + UUID.randomUUID() + "@bigbike.vn");
        MvcResult listResult = mockMvc.perform(get("/api/v1/customer/addresses").cookie(b.cookies))
                .andExpect(status().isOk())
                .andReturn();

        assertThat(listResult.getResponse().getContentAsString())
                .doesNotContain(addressId.toString());
    }

    // ── Public lookups do not leak on a wrong/unknown key ────────────────────

    @Test
    void orderLookupWithWrongKeyReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/orders/lookup")
                        .param("orderNumber", "BB-DOES-NOT-EXIST")
                        .param("orderKey", "wrong-key-" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    void warrantyLookupWithUnknownSerialReturns404() throws Exception {
        mockMvc.perform(get("/api/v1/warranties/lookup")
                        .param("serial", "NO-SUCH-SERIAL-" + UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private record Session(Cookie[] cookies, String csrf) {}

    private Cookie[] registerAndLogin(String email) throws Exception {
        return login(email).cookies;
    }

    private Session login(String email) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk());

        MvcResult result = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"secret123\"}"))
                .andExpect(status().isOk())
                .andReturn();

        MockHttpServletResponse response = result.getResponse();
        return new Session(response.getCookies(), cookieValue(response, "bb_csrf"));
    }

    private UUID createAddress(Session session, String fullName) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/customer/addresses")
                        .cookie(session.cookies)
                        .header("X-CSRF-Token", session.csrf)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addressBody(fullName)))
                .andExpect(status().isCreated())
                .andReturn();
        String id = JsonPath.read(result.getResponse().getContentAsString(), "$.data.id");
        return UUID.fromString(id);
    }

    private String addressBody(String fullName) {
        return "{"
                + "\"type\":\"SHIPPING\","
                + "\"fullName\":\"" + fullName + "\","
                + "\"phone\":\"0901234567\","
                + "\"province\":\"Ha Noi\","
                + "\"district\":\"Cau Giay\","
                + "\"ward\":\"Dich Vong\","
                + "\"addressLine1\":\"12 Tran Thai Tong\","
                + "\"isDefault\":true"
                + "}";
    }

    private String cookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
