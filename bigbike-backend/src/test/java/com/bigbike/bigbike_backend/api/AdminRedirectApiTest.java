package com.bigbike.bigbike_backend.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.auth.AdminPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import com.bigbike.bigbike_backend.service.auth.AdminPermissionService;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminRedirectApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private RedirectJpaRepository redirectJpaRepository;

    @Autowired
    private AdminPermissionService adminPermissionService;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(springSecurity())
                .build();
        // Evict permission cache so DB seed is picked up after context start
        adminPermissionService.evict("ADMIN");
        adminPermissionService.evict("SEO_EDITOR");
    }

    /**
     * Returns a JWT-based authentication that passes Spring Security's .authenticated() check
     * but does NOT set an AdminPrincipal — so DevAdminAuthService falls through to the
     * X-Admin-Permissions header bypass (dev/test path).
     */
    private static RequestPostProcessor devAuth() {
        return authentication(new UsernamePasswordAuthenticationToken(
                "dev-test-user", null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        ));
    }

    /**
     * Returns authentication with a real AdminPrincipal so DevAdminAuthService uses the
     * DB-backed permission resolver — the production code path.
     */
    private static RequestPostProcessor principalAuth(String adminId, String role) {
        AdminPrincipal principal = new AdminPrincipal(adminId, adminId + "@test.local", role);
        return authentication(new UsernamePasswordAuthenticationToken(
                principal, null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        ));
    }

    // ── URL-level security ────────────────────────────────────────────────────

    @Test
    void shouldReturn401WhenUnauthenticated() throws Exception {
        mockMvc.perform(get("/api/v1/admin/redirects"))
                .andExpect(status().isUnauthorized());
    }

    // ── SEO_EDITOR role — DB-backed permission check ──────────────────────────

    @Test
    void shouldAllowSeoEditorToListAndCreateRedirects() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourcePattern = "/seo-test-" + suffix;
        String targetUrl = "/sp/?q=seo-" + suffix;

        mockMvc.perform(get("/api/v1/admin/redirects")
                        .with(principalAuth("seo-id", "SEO_EDITOR"))
                        .param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(principalAuth("seo-id", "SEO_EDITOR"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "%s",
                                  "enabled": true
                                }
                                """.formatted(sourcePattern, targetUrl)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourcePattern").value(sourcePattern));

        redirectJpaRepository.findBySourcePattern(sourcePattern)
                .ifPresent(redirectJpaRepository::delete);
    }

    // ── CRUD happy path (dev-header bypass) ───────────────────────────────────

    @Test
    void shouldListCreateUpdateAndDeleteRedirects() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourcePattern = "/legacy-product-" + suffix;
        String targetUrl = "/sp/?q=redirect-" + suffix;

        mockMvc.perform(get("/api/v1/admin/redirects")
                        .with(devAuth())
                        .param("page", "1")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "redirects.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1));

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "%s",
                                  "enabled": true,
                                  "notes": "SEO migration test"
                                }
                                """.formatted(sourcePattern, targetUrl)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourcePattern").value(sourcePattern))
                .andExpect(jsonPath("$.data.targetUrl").value(targetUrl))
                .andExpect(jsonPath("$.data.statusCode").doesNotExist())
                .andExpect(jsonPath("$.data.redirectType").doesNotExist())
                .andExpect(jsonPath("$.data.enabled").value(true));

        RedirectEntity created = redirectJpaRepository.findBySourcePattern(sourcePattern)
                .orElseThrow(() -> new IllegalStateException("Expected redirect to be created."));

        mockMvc.perform(get("/api/v1/admin/redirects/{id}", created.getId())
                        .with(devAuth())
                        .header("X-Admin-Permissions", "redirects.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(created.getId().toString()))
                .andExpect(jsonPath("$.data.sourcePattern").value(sourcePattern));

        mockMvc.perform(patch("/api/v1/admin/redirects/{id}", created.getId())
                        .with(devAuth())
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
                        .with(devAuth())
                        .header("X-Admin-Permissions", "redirects.write"))
                .andExpect(status().isNoContent());
    }

    @Test
    void internalLookupReturnsOnlyTargetAndRedirectId() throws Exception {
        String sourcePattern = "/internal-lookup-" + UUID.randomUUID().toString().substring(0, 8);
        RedirectEntity entity = new RedirectEntity();
        entity.setSourcePattern(sourcePattern);
        entity.setTargetUrl("/internal-target");
        entity.setEnabled(true);
        entity.setCreatedAt(java.time.Instant.now());
        entity.setUpdatedAt(java.time.Instant.now());
        RedirectEntity saved = redirectJpaRepository.save(entity);

        mockMvc.perform(get("/api/internal/redirect")
                        .param("path", sourcePattern))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.redirectId").value(saved.getId().toString()))
                .andExpect(jsonPath("$.target").value("/internal-target"))
                .andExpect(jsonPath("$.statusCode").doesNotExist())
                .andExpect(jsonPath("$.redirectType").doesNotExist());

        redirectJpaRepository.delete(saved);
    }

    // ── Permission checks ─────────────────────────────────────────────────────

    @Test
    void shouldForbidWhenPermissionMissing() throws Exception {
        mockMvc.perform(get("/api/v1/admin/redirects")
                        .with(devAuth())
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    // ── Input validation ──────────────────────────────────────────────────────

    @Test
    void shouldValidateRedirectInput() throws Exception {
        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
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

    @Test
    void shouldRejectPathEquivalentSelfLoops() throws Exception {
        for (String target : List.of(
                "/same-path?campaign=summer",
                "/same-path#details",
                "https://bigbike.vn/same-path")) {
            mockMvc.perform(post("/api/v1/admin/redirects")
                            .with(devAuth())
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-Admin-Permissions", "redirects.write")
                            .content("""
                                    {
                                      "sourcePattern": "/same-path",
                                      "targetUrl": "%s"
                                    }
                                    """.formatted(target)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                    .andExpect(jsonPath("$.error.details[0].code").value("SELF_LOOP"));
        }
    }

    @Test
    void shouldRejectInvalidSourceShapes() throws Exception {
        for (String source : List.of("https://bigbike.vn/old", "//evil.example/old", "/old?q=1", "/old#section")) {
            mockMvc.perform(post("/api/v1/admin/redirects")
                            .with(devAuth())
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-Admin-Permissions", "redirects.write")
                            .content("""
                                    {"sourcePattern":"%s","targetUrl":"/valid-target"}
                                    """.formatted(source)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.details[0].code").value("INVALID_SOURCE"));
        }
    }

    @Test
    void shouldSearchNotesAndReturnDatabasePagination() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        RedirectEntity first = redirectJpaRepository.save(redirect(
                "/notes-search-a-" + suffix, "/notes-target-a", "campaign-needle-" + suffix));
        RedirectEntity second = redirectJpaRepository.save(redirect(
                "/notes-search-b-" + suffix, "/notes-target-b", "campaign-needle-" + suffix));

        try {
            mockMvc.perform(get("/api/v1/admin/redirects")
                            .with(devAuth())
                            .param("page", "1")
                            .param("size", "1")
                            .param("q", "campaign-needle-" + suffix)
                            .header("X-Admin-Permissions", "redirects.read"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.length()").value(1))
                    .andExpect(jsonPath("$.pagination.totalItems").value(2))
                    .andExpect(jsonPath("$.pagination.totalPages").value(2));
        } finally {
            redirectJpaRepository.deleteAll(List.of(first, second));
        }
    }

    @Test
    void shouldRejectDuplicateSourcePattern() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourcePattern = "/dup-test-" + suffix;

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {"sourcePattern":"%s","targetUrl":"/target-a-%s"}
                                """.formatted(sourcePattern, suffix)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {"sourcePattern":"%s","targetUrl":"/target-b-%s"}
                                """.formatted(sourcePattern, suffix)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        redirectJpaRepository.findBySourcePattern(sourcePattern)
                .ifPresent(redirectJpaRepository::delete);
    }

    @Test
    void shouldRejectExternalTarget() throws Exception {
        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "/external-redirect-test",
                                  "targetUrl": "https://evil.com/steal-session"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void shouldTreatTrailingSlashAsDuplicateSourcePattern() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourcePattern = "/slash-test-" + suffix;

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {"sourcePattern":"%s","targetUrl":"/target-slash-%s"}
                                """.formatted(sourcePattern, suffix)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {"sourcePattern":"%s/","targetUrl":"/target-slash-b-%s"}
                                """.formatted(sourcePattern, suffix)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        redirectJpaRepository.findBySourcePattern(sourcePattern)
                .ifPresent(redirectJpaRepository::delete);
    }

    @Test
    void patchRedirect_clearsNotesWithEmptyString_butKeepsLegacyId() throws Exception {
        // Contract (fix 2026-07-06, audit #8): PATCH is presence-guarded. Explicit "" clears
        // notes; legacyId can only be OVERWRITTEN — a bare JSON null is indistinguishable
        // from "field omitted", so it must be kept, not wiped.
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourcePattern = "/clear-fields-test-" + suffix;

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "/target-clear-%s",
                                  "notes": "Ghi chu ban dau",
                                  "legacyId": 123
                                }
                                """.formatted(sourcePattern, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.notes").value("Ghi chu ban dau"))
                .andExpect(jsonPath("$.data.legacyId").value(123));

        RedirectEntity created = redirectJpaRepository.findBySourcePattern(sourcePattern)
                .orElseThrow(() -> new IllegalStateException("Expected redirect to be created."));

        mockMvc.perform(patch("/api/v1/admin/redirects/{id}", created.getId())
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "notes": "",
                                  "legacyId": null
                                }
                                """))
                .andExpect(status().isOk());

        RedirectEntity updated = redirectJpaRepository.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Expected redirect to still exist."));
        assertNull(updated.getNotes(), "explicit empty string must clear notes");
        assertEquals(Long.valueOf(123), updated.getLegacyId(),
                "a bare null must NOT wipe legacyId (presence-guarded PATCH)");

        redirectJpaRepository.delete(updated);
    }

    @Test
    void shouldRejectLegacyRedirectStatusFields() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String sourcePattern = "/legacy-status-" + suffix;
        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "/valid-target",
                                  "statusCode": 302,
                                  "redirectType": "TEMPORARY"
                                }
                                """.formatted(sourcePattern)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].code").value("UNSUPPORTED"));
    }

    private static RedirectEntity redirect(String sourcePattern, String targetUrl, String notes) {
        RedirectEntity entity = new RedirectEntity();
        entity.setSourcePattern(sourcePattern);
        entity.setTargetUrl(targetUrl);
        entity.setNotes(notes);
        entity.setEnabled(true);
        entity.setCreatedAt(java.time.Instant.now());
        entity.setUpdatedAt(java.time.Instant.now());
        return entity;
    }
}
