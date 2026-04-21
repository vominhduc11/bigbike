package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class Phase1KOpenApiContractTest {

    @Autowired
    private WebApplicationContext context;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders
                .webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── Helper ────────────────────────────────────────────────────────────────

    private String fetchApiDocs() throws Exception {
        MvcResult result = mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andReturn();
        return result.getResponse().getContentAsString();
    }

    // ── 1. Endpoint availability ──────────────────────────────────────────────

    @Test
    void openApiDocsEndpoint_availableInTestOrDev() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk());
    }

    // ── 2. Security schemes ───────────────────────────────────────────────────

    @Test
    void openApi_containsAdminBearerSecurityScheme() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("AdminBearerAuth");
    }

    @Test
    void openApi_containsCustomerSessionCookieScheme() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("CustomerSession");
    }

    @Test
    void openApi_containsCsrfHeader() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("X-CSRF-Token");
    }

    // ── 3. Endpoint coverage ──────────────────────────────────────────────────

    @Test
    void openApi_containsCartEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/cart");
    }

    @Test
    void openApi_containsCheckoutEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/checkout");
    }

    @Test
    void openApi_containsAdminOrderEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/admin/orders");
    }

    @Test
    void openApi_containsAdminCustomerMediaRedirectEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/admin/customers");
        assertThat(body).contains("/api/v1/admin/media");
        assertThat(body).contains("/api/v1/admin/redirects");
    }

    @Test
    void openApi_containsAdminSettingsMenuCouponEndpoints() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).contains("/api/v1/admin/settings");
        assertThat(body).contains("/api/v1/admin/menus");
        assertThat(body).contains("/api/v1/admin/coupons");
    }

    // ── 4. Security — sensitive data not exposed ──────────────────────────────

    @Test
    void openApi_doesNotExposePasswordHash() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).doesNotContain("passwordHash");
    }

    @Test
    void openApi_doesNotExposeStorageBucketSecret() throws Exception {
        String body = fetchApiDocs();
        assertThat(body).doesNotContain("storageBucket");
        assertThat(body).doesNotContain("\"bucket\"");
    }

    // ── 5. Regression ─────────────────────────────────────────────────────────

    @Test
    void openApi_responseIsValidJson() throws Exception {
        String body = fetchApiDocs();
        // Must start with '{' (JSON object) and contain openapi version key
        assertThat(body.trim()).startsWith("{");
        assertThat(body).contains("\"openapi\"");
        assertThat(body).contains("3.0");
    }
}
