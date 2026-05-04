package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminRedirectApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private RedirectJpaRepository redirectJpaRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .build();
    }

    @Test
    void shouldListCreateUpdateAndDeleteRedirects() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourcePattern = "/legacy-product-" + suffix;
        String targetUrl = "/san-pham/redirect-" + suffix;

        mockMvc.perform(get("/api/v1/admin/redirects")
                        .param("page", "1")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "redirects.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "%s",
                                  "statusCode": 301,
                                  "enabled": true,
                                  "notes": "SEO migration test"
                                }
                                """.formatted(sourcePattern, targetUrl)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourcePattern").value(sourcePattern))
                .andExpect(jsonPath("$.data.targetUrl").value(targetUrl))
                .andExpect(jsonPath("$.data.statusCode").value(301))
                .andExpect(jsonPath("$.data.enabled").value(true));

        RedirectEntity created = redirectJpaRepository.findBySourcePattern(sourcePattern)
                .orElseThrow(() -> new IllegalStateException("Expected redirect to be created."));

        mockMvc.perform(get("/api/v1/admin/redirects/{id}", created.getId())
                        .header("X-Admin-Permissions", "redirects.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(created.getId().toString()))
                .andExpect(jsonPath("$.data.sourcePattern").value(sourcePattern));

        mockMvc.perform(patch("/api/v1/admin/redirects/{id}", created.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "targetUrl": "%s-updated",
                                  "enabled": false,
                                  "notes": "Disabled after verification"
                                }
                                """.formatted(targetUrl)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetUrl").value(targetUrl + "-updated"))
                .andExpect(jsonPath("$.data.enabled").value(false));

        mockMvc.perform(delete("/api/v1/admin/redirects/{id}", created.getId())
                        .header("X-Admin-Permissions", "redirects.write"))
                .andExpect(status().isNoContent());
    }

    @Test
    void shouldForbidWhenPermissionMissing() throws Exception {
        mockMvc.perform(get("/api/v1/admin/redirects")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void shouldValidateRedirectInput() throws Exception {
        mockMvc.perform(post("/api/v1/admin/redirects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "/self-loop",
                                  "targetUrl": "/self-loop"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
