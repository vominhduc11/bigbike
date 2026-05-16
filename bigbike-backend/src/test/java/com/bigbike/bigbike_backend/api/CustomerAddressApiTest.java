package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
 * Covers FULL-12 batch 1: customer addresses CRUD — auth gates, create/list/update/delete,
 * ownership boundaries (A cannot update/delete B's addresses).
 */
@SpringBootTest
class CustomerAddressApiTest {

    private static final String VALID_ADDRESS = """
            {"type":"SHIPPING","fullName":"Nguyen Van Test","phone":"0909123456",
             "province":"Ha Noi","district":"Cau Giay","ward":"Trung Hoa",
             "addressLine1":"123 Duong Test","isDefault":false}
            """;

    @Autowired WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── 1. Unauthenticated access ─────────────────────────────────────────────

    @Test
    void listAddresses_withoutSession_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/customer/addresses"))
                .andExpect(status().isUnauthorized());
    }

    // ── 2. Create address ─────────────────────────────────────────────────────

    @Test
    void createAddress_authenticated_returns201WithData() throws Exception {
        AuthSession session = loginCustomer("addr-create-" + UUID.randomUUID() + "@bigbike.vn");

        mockMvc.perform(post("/api/v1/customer/addresses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_ADDRESS)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").isNotEmpty())
                .andExpect(jsonPath("$.data.type").value("SHIPPING"))
                .andExpect(jsonPath("$.data.fullName").value("Nguyen Van Test"))
                .andExpect(jsonPath("$.data.province").value("Ha Noi"));
    }

    // ── 3. List only own addresses ────────────────────────────────────────────

    @Test
    void listAddresses_returnsOwnAddresses() throws Exception {
        AuthSession session = loginCustomer("addr-list-" + UUID.randomUUID() + "@bigbike.vn");
        String addressId = createAddressAndGetId(session);

        MvcResult result = mockMvc.perform(get("/api/v1/customer/addresses").cookie(session.cookies))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).contains(addressId);
    }

    @Test
    void listAddresses_doesNotIncludeOtherCustomerAddresses() throws Exception {
        AuthSession sessionA = loginCustomer("addr-iso-a-" + UUID.randomUUID() + "@bigbike.vn");
        AuthSession sessionB = loginCustomer("addr-iso-b-" + UUID.randomUUID() + "@bigbike.vn");

        String addressIdB = createAddressAndGetId(sessionB);

        // A's list must not contain B's address ID.
        MvcResult resultA = mockMvc.perform(get("/api/v1/customer/addresses").cookie(sessionA.cookies))
                .andExpect(status().isOk()).andReturn();
        assertThat(resultA.getResponse().getContentAsString()).doesNotContain(addressIdB);
    }

    // ── 4. Update own address ─────────────────────────────────────────────────

    @Test
    void updateAddress_ownAddress_succeeds() throws Exception {
        AuthSession session = loginCustomer("addr-upd-" + UUID.randomUUID() + "@bigbike.vn");
        String addressId = createAddressAndGetId(session);

        String updatedBody = """
                {"type":"SHIPPING","fullName":"Nguyen Van Da Sua","phone":"0909999888",
                 "province":"TP.HCM","district":"Quan 1","ward":"Ben Nghe",
                 "addressLine1":"456 Duong Moi","isDefault":false}
                """;

        mockMvc.perform(patch("/api/v1/customer/addresses/" + addressId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updatedBody)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.fullName").value("Nguyen Van Da Sua"))
                .andExpect(jsonPath("$.data.province").value("TP.HCM"));
    }

    // ── 5. Update another customer's address → 404 ───────────────────────────

    @Test
    void updateAddress_otherCustomerAddress_returns404() throws Exception {
        AuthSession sessionA = loginCustomer("addr-upd-a-" + UUID.randomUUID() + "@bigbike.vn");
        AuthSession sessionB = loginCustomer("addr-upd-b-" + UUID.randomUUID() + "@bigbike.vn");

        String addressIdB = createAddressAndGetId(sessionB);

        // findByIdAndCustomerId(B_id, A_customerId) returns empty → NotFoundException → 404.
        mockMvc.perform(patch("/api/v1/customer/addresses/" + addressIdB)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_ADDRESS)
                        .cookie(sessionA.cookies).header("X-CSRF-Token", sessionA.csrf))
                .andExpect(status().isNotFound());
    }

    // ── 6. Delete own address ─────────────────────────────────────────────────

    @Test
    void deleteAddress_ownAddress_returns204AndAddressGone() throws Exception {
        AuthSession session = loginCustomer("addr-del-" + UUID.randomUUID() + "@bigbike.vn");
        String addressId = createAddressAndGetId(session);

        mockMvc.perform(delete("/api/v1/customer/addresses/" + addressId)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isNoContent());

        MvcResult result = mockMvc.perform(get("/api/v1/customer/addresses").cookie(session.cookies))
                .andExpect(status().isOk()).andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain(addressId);
    }

    // ── 7. Delete another customer's address → 404 ───────────────────────────

    @Test
    void deleteAddress_otherCustomerAddress_returns404() throws Exception {
        AuthSession sessionA = loginCustomer("addr-del-a-" + UUID.randomUUID() + "@bigbike.vn");
        AuthSession sessionB = loginCustomer("addr-del-b-" + UUID.randomUUID() + "@bigbike.vn");

        String addressIdB = createAddressAndGetId(sessionB);

        // findByIdAndCustomerId(B_id, A_customerId) returns empty → NotFoundException → 404.
        mockMvc.perform(delete("/api/v1/customer/addresses/" + addressIdB)
                        .cookie(sessionA.cookies).header("X-CSRF-Token", sessionA.csrf))
                .andExpect(status().isNotFound());
    }

    // ── 8. Validation ─────────────────────────────────────────────────────────

    @Test
    void createAddress_missingRequiredField_returns400() throws Exception {
        AuthSession session = loginCustomer("addr-val-" + UUID.randomUUID() + "@bigbike.vn");

        // @NotBlank on fullName — omitting it triggers Bean Validation → 400.
        String missingFullName = """
                {"type":"SHIPPING","phone":"0909123456",
                 "province":"Ha Noi","district":"Cau Giay","ward":"Trung Hoa",
                 "addressLine1":"123 Test"}
                """;

        mockMvc.perform(post("/api/v1/customer/addresses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(missingFullName)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createAddress_invalidPhone_returns400() throws Exception {
        AuthSession session = loginCustomer("addr-ph-" + UUID.randomUUID() + "@bigbike.vn");

        // @Pattern(regexp = "^\\+?[0-9]{8,15}$") — letters fail → 400.
        String invalidPhone = """
                {"type":"SHIPPING","fullName":"Test","phone":"INVALID-PHONE",
                 "province":"Ha Noi","district":"Cau Giay","ward":"Trung Hoa",
                 "addressLine1":"123 Test"}
                """;

        mockMvc.perform(post("/api/v1/customer/addresses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidPhone)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isBadRequest());
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private AuthSession loginCustomer(String email) throws Exception {
        mockMvc.perform(post("/api/v1/customer/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk());
        MvcResult loginResult = mockMvc.perform(post("/api/v1/customer/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"login\":\"" + email + "\",\"password\":\"pass1234\"}"))
                .andExpect(status().isOk())
                .andReturn();
        Cookie[] cookies = loginResult.getResponse().getCookies();
        String csrf = findCookieValue(loginResult.getResponse(), "bb_csrf");
        return new AuthSession(cookies, csrf);
    }

    private String createAddressAndGetId(AuthSession session) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/customer/addresses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(VALID_ADDRESS)
                        .cookie(session.cookies).header("X-CSRF-Token", session.csrf))
                .andExpect(status().isCreated())
                .andReturn();
        return extractJsonValue(result.getResponse().getContentAsString(), "id");
    }

    private String extractJsonValue(String json, String key) {
        String marker = "\"" + key + "\":\"";
        int start = json.indexOf(marker);
        if (start < 0) return null;
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }

    private String findCookieValue(MockHttpServletResponse response, String name) {
        Cookie[] cookies = response.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private record AuthSession(Cookie[] cookies, String csrf) {}
}
