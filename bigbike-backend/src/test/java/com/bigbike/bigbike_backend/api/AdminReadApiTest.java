package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class AdminReadApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldReturnCurrentAdminUserInDevPlaceholderMode() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("dev-admin-user"))
                .andExpect(jsonPath("$.data.roles[0]").value("ADMIN"))
                .andExpect(jsonPath("$.data.permissions").isArray())
                .andExpect(jsonPath("$.meta.requestId").exists())
                .andExpect(jsonPath("$.meta.timestamp").exists());
    }

    @Test
    void shouldReturnAdminProductListAndDetail() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products")
                        .param("page", "1")
                        .param("size", "8")
                        .param("sort", "updatedAt:desc")
                        .param("q", "ls2")
                        .param("publishStatus", "PUBLISHED")
                        .param("stockState", "IN_STOCK")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].price.currency").value("VND"))
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(8))
                .andExpect(jsonPath("$.meta.requestId").exists());

        mockMvc.perform(get("/api/v1/admin/products/prod_ls2_ff800")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("prod_ls2_ff800"))
                .andExpect(jsonPath("$.data.slug").value("mu-bao-hiem-ls2-ff800"));
    }

    @Test
    void shouldReturnCategoryBrandAndContentAdminReadData() throws Exception {
        mockMvc.perform(get("/api/v1/admin/categories")
                        .param("search", "mu")
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].id").exists());

        mockMvc.perform(get("/api/v1/admin/brands/brand_ls2")
                        .header("X-Admin-Permissions", "catalog.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("brand_ls2"));

        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "ARTICLE")
                        .param("publishStatus", "PUBLISHED")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].type").exists());

        mockMvc.perform(get("/api/v1/admin/content/article/article_chon_mu_fullface")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("article_chon_mu_fullface"))
                .andExpect(jsonPath("$.data.type").value("ARTICLE"));
    }

    @Test
    void shouldReturnForbiddenWhenPermissionMissing() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void shouldValidateAdminQueryParams() throws Exception {
        mockMvc.perform(get("/api/v1/admin/products")
                        .param("sort", "unknown:desc")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("sort"));

        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "INVALID")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("type"));
    }
}
