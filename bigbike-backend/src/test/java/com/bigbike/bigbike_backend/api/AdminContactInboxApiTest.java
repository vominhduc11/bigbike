package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.contact.ContactMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.contact.ContactMessageJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Covers FULL-12 batch 2: admin contact inbox — list, filter, detail, permission gates,
 * and resolvedAt stamp/clear on status transitions.
 * Endpoints: GET/PATCH /api/v1/admin/contact-messages[/{id}].
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminContactInboxApiTest {

    private static final String ADMIN_EMAIL  = "inbox-admin-"  + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS   = "Admin@Inbox1234";
    private static final String EDITOR_EMAIL = "inbox-editor-" + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_PASS  = "Editor@Inbox1234";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired ContactMessageJpaRepository contactRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;
    private String editorToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser(ADMIN_EMAIL,  ADMIN_PASS,  "ADMIN");
        ensureAdminUser(EDITOR_EMAIL, EDITOR_PASS, "EDITOR");
        adminToken  = loginAdmin(ADMIN_EMAIL,  ADMIN_PASS);
        editorToken = loginAdmin(EDITOR_EMAIL, EDITOR_PASS);
    }

    // ── 1. List — auth gates ─────────────────────────────────────────────────

    @Test
    void listContactMessages_withoutToken_returns401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/contact-messages"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void listContactMessages_editorLacksContactRead_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/contact-messages")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void listContactMessages_adminHasContactRead_returns200WithPagedItems() throws Exception {
        mockMvc.perform(get("/api/v1/admin/contact-messages")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.pageSize").value(20));
    }

    // ── 2. Filter by status ──────────────────────────────────────────────────

    @Test
    void listContactMessages_filterByStatus_returnsOnlyMatchingMessages() throws Exception {
        String resolvedPhone = "0921" + UUID.randomUUID().toString().replace("-", "").substring(0, 7);
        String openPhone     = "0922" + UUID.randomUUID().toString().replace("-", "").substring(0, 7);
        createMsg(resolvedPhone, "RESOLVED");
        createMsg(openPhone,     "OPEN");

        // ?status=RESOLVED → resolvedPhone in, openPhone out.
        String resolvedBody = mockMvc.perform(get("/api/v1/admin/contact-messages")
                        .param("status", "RESOLVED")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(resolvedBody).contains(resolvedPhone);
        assertThat(resolvedBody).doesNotContain(openPhone);

        // ?status=OPEN → openPhone in, resolvedPhone out.
        String openBody = mockMvc.perform(get("/api/v1/admin/contact-messages")
                        .param("status", "OPEN")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(openBody).contains(openPhone);
        assertThat(openBody).doesNotContain(resolvedPhone);
    }

    // ── 3. Detail — auth gates ────────────────────────────────────────────────

    @Test
    void getContactDetail_adminHasContactRead_returns200WithFullContent() throws Exception {
        String phone = "0931" + UUID.randomUUID().toString().replace("-", "").substring(0, 7);
        String content = "Noi dung tin nhan chi tiet - " + UUID.randomUUID();
        ContactMessageEntity msg = createMsgWithContent(phone, "OPEN", content);

        MvcResult result = mockMvc.perform(get("/api/v1/admin/contact-messages/" + msg.getId())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains(phone);
        assertThat(body).contains("\"status\":\"OPEN\"");
        // Detail exposes full content (unlike list which has contentPreview).
        assertThat(body).contains(content);
    }

    @Test
    void getContactDetail_editorLacksContactRead_returns403() throws Exception {
        ContactMessageEntity msg = createMsg(
                "0932" + UUID.randomUUID().toString().replace("-", "").substring(0, 7), "OPEN");

        mockMvc.perform(get("/api/v1/admin/contact-messages/" + msg.getId())
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    // ── 4. Update — resolvedAt stamping and clearing ─────────────────────────

    @Test
    void updateContact_toResolved_stampsResolvedAt() throws Exception {
        ContactMessageEntity msg = createMsg(
                "0941" + UUID.randomUUID().toString().replace("-", "").substring(0, 7), "OPEN");

        MvcResult result = mockMvc.perform(patch("/api/v1/admin/contact-messages/" + msg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"status\":\"RESOLVED\"");
        // resolvedAt must be a non-null timestamp after entering terminal state.
        assertThat(body).doesNotContain("\"resolvedAt\":null");
    }

    @Test
    void updateContact_reopenFromResolved_clearsResolvedAt() throws Exception {
        ContactMessageEntity msg = createMsg(
                "0942" + UUID.randomUUID().toString().replace("-", "").substring(0, 7), "OPEN");

        // Step 1: resolve → stamps resolvedAt.
        mockMvc.perform(patch("/api/v1/admin/contact-messages/" + msg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVED\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Step 2: reopen to IN_PROGRESS → resolvedAt must be cleared.
        MvcResult result = mockMvc.perform(patch("/api/v1/admin/contact-messages/" + msg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"status\":\"IN_PROGRESS\"");
        assertThat(body).contains("\"resolvedAt\":null");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ContactMessageEntity createMsg(String phone, String status) {
        return createMsgWithContent(phone, status, "Test content - " + UUID.randomUUID());
    }

    private ContactMessageEntity createMsgWithContent(String phone, String status, String content) {
        ContactMessageEntity m = new ContactMessageEntity();
        m.setFullName("Test Customer");
        m.setPhone(phone);
        m.setEmail("test-" + UUID.randomUUID() + "@example.com");
        m.setContent(content);
        m.setStatus(status);
        Instant now = Instant.now();
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        return contactRepo.save(m);
    }

    private void ensureAdminUser(String email, String password, String role) {
        adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("Inbox Test " + role);
            admin.setRole(role);
            admin.setStatus("ACTIVE");
            Instant now = Instant.now();
            admin.setCreatedAt(now);
            admin.setUpdatedAt(now);
            return adminUserRepo.save(admin);
        });
    }

    private String loginAdmin(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String json = result.getResponse().getContentAsString();
        String marker = "\"accessToken\":\"";
        int start = json.indexOf(marker);
        if (start < 0) throw new IllegalStateException("accessToken not found");
        start += marker.length();
        int end = json.indexOf("\"", start);
        return json.substring(start, end);
    }
}
