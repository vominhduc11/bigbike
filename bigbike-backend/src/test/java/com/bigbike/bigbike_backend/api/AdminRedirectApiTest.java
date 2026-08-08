package com.bigbike.bigbike_backend.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
                                  "enabled": true
                                }
                                """.formatted(sourcePattern, targetUrl)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.sourcePattern").value(sourcePattern))
                .andExpect(jsonPath("$.data.targetUrl").value(targetUrl))
                .andExpect(jsonPath("$.data.statusCode").doesNotExist())
                .andExpect(jsonPath("$.data.redirectType").doesNotExist())
                .andExpect(jsonPath("$.data.notes").doesNotExist())
                .andExpect(jsonPath("$.data.legacyId").doesNotExist())
                .andExpect(jsonPath("$.data.chainHops").doesNotExist())
                .andExpect(jsonPath("$.data.finalTarget").doesNotExist())
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
                                  "enabled": false
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
    void shouldSearchSourceAndTargetAndReturnDatabasePagination() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        RedirectEntity first = redirectJpaRepository.save(redirect(
                "/search-needle-" + suffix + "-a", "/search-target-" + suffix + "-a"));
        RedirectEntity second = redirectJpaRepository.save(redirect(
                "/search-needle-" + suffix + "-b", "/search-target-" + suffix + "-b"));

        try {
            mockMvc.perform(get("/api/v1/admin/redirects")
                            .with(devAuth())
                            .param("page", "1")
                            .param("size", "1")
                            .param("q", "search-needle-" + suffix)
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

    private static RedirectEntity redirect(String sourcePattern, String targetUrl) {
        RedirectEntity entity = new RedirectEntity();
        entity.setSourcePattern(sourcePattern);
        entity.setTargetUrl(targetUrl);
        entity.setEnabled(true);
        entity.setCreatedAt(java.time.Instant.now());
        entity.setUpdatedAt(java.time.Instant.now());
        return entity;
    }

    // ── Auto-collapse to final destination on save (REDIRECT_RULE_010) ────────

    /**
     * A→B plus a NEW rule C→A: at save time, A already redirects onward to B, so C must be
     * persisted pointing straight at B — never at the intermediate A — so every stored redirect
     * always represents exactly one hop for a visitor.
     */
    @Test
    void shouldCollapseTargetToFinalDestinationOnCreate() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String a = "/collapse-a-" + suffix;
        String b = "/collapse-b-" + suffix;
        String c = "/collapse-c-" + suffix;

        createRedirect(a, b);

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "%s",
                                  "enabled": true
                                }
                                """.formatted(c, a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetUrl").value(b))
                .andExpect(jsonPath("$.data.chainHops").doesNotExist())
                .andExpect(jsonPath("$.data.finalTarget").doesNotExist());

        RedirectEntity ruleA = redirectJpaRepository.findBySourcePattern(a).orElseThrow();
        RedirectEntity ruleC = redirectJpaRepository.findBySourcePattern(c).orElseThrow();
        assertEquals(b, ruleC.getTargetUrl(), "stored targetUrl must be the final destination, not the intermediate a");

        redirectJpaRepository.delete(ruleA);
        redirectJpaRepository.delete(ruleC);
    }

    /** Same collapse, but via PATCH updating an existing redirect's targetUrl. */
    @Test
    void shouldCollapseTargetToFinalDestinationOnUpdate() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String x = "/collapse-x-" + suffix;
        String y = "/collapse-y-" + suffix;
        String z = "/collapse-z-" + suffix;
        String other = "/collapse-other-" + suffix;

        createRedirect(y, z);
        createRedirect(x, other);
        RedirectEntity ruleX = redirectJpaRepository.findBySourcePattern(x).orElseThrow();

        mockMvc.perform(patch("/api/v1/admin/redirects/{id}", ruleX.getId())
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {"targetUrl": "%s"}
                                """.formatted(y)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetUrl").value(z));

        RedirectEntity updated = redirectJpaRepository.findById(ruleX.getId()).orElseThrow();
        assertEquals(z, updated.getTargetUrl(), "PATCH must also collapse to the final destination");

        redirectJpaRepository.delete(updated);
        redirectJpaRepository.findBySourcePattern(y).ifPresent(redirectJpaRepository::delete);
    }

    /**
     * A disabled rule redirects nobody in production, so it must not be treated as a real chain
     * link: creating C→A while A→B exists but A is DISABLED must persist C→A unchanged.
     */
    @Test
    void shouldNotCollapseThroughADisabledRedirect() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String a = "/collapse-disabled-a-" + suffix;
        String b = "/collapse-disabled-b-" + suffix;
        String c = "/collapse-disabled-c-" + suffix;

        createRedirect(a, b);
        RedirectEntity ruleA = redirectJpaRepository.findBySourcePattern(a).orElseThrow();
        ruleA.setEnabled(false);
        redirectJpaRepository.save(ruleA);

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "%s",
                                  "enabled": true
                                }
                                """.formatted(c, a)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.targetUrl").value(a));

        RedirectEntity ruleC = redirectJpaRepository.findBySourcePattern(c).orElseThrow();
        assertEquals(a, ruleC.getTargetUrl(), "must not collapse through a disabled rule");

        redirectJpaRepository.delete(ruleA);
        redirectJpaRepository.delete(ruleC);
    }

    /** A real loop (A→B→A) must still be rejected outright, never silently collapsed. */
    @Test
    void shouldStillRejectMultiHopLoop() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String a = "/loop-a-" + suffix;
        String b = "/loop-b-" + suffix;

        createRedirect(a, b);

        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "%s",
                                  "enabled": true
                                }
                                """.formatted(b, a)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].code").value("REDIRECT_LOOP"));

        redirectJpaRepository.findBySourcePattern(a).ifPresent(redirectJpaRepository::delete);
    }

    private void createRedirect(String sourcePattern, String targetUrl) throws Exception {
        mockMvc.perform(post("/api/v1/admin/redirects")
                        .with(devAuth())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "redirects.write")
                        .content("""
                                {
                                  "sourcePattern": "%s",
                                  "targetUrl": "%s",
                                  "enabled": true
                                }
                                """.formatted(sourcePattern, targetUrl)))
                .andExpect(status().isOk());
    }
}
