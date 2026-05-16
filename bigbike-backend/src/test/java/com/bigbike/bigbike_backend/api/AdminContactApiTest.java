package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.contact.ContactMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.contact.ContactMessageJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import java.time.Instant;
import java.util.List;
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
 * Covers FULL-03: admin updates to a contact message must write an audit log.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class AdminContactApiTest {

    private static final String ADMIN_EMAIL = "contact-admin-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@Contact1234";

    private static final String EDITOR_EMAIL = "contact-editor-" + UUID.randomUUID() + "@bigbike.test";
    private static final String EDITOR_PASS  = "Editor@Contact1234";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired ContactMessageJpaRepository contactRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;
    private String editorToken;
    private UUID adminId;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        adminId = ensureAdminUser(ADMIN_EMAIL, ADMIN_PASS, "ADMIN").getId();
        ensureAdminUser(EDITOR_EMAIL, EDITOR_PASS, "EDITOR");
        adminToken = loginAdmin(ADMIN_EMAIL, ADMIN_PASS);
        editorToken = loginAdmin(EDITOR_EMAIL, EDITOR_PASS);
    }

    @Test
    void updateContact_withoutToken_returns401() throws Exception {
        ContactMessageEntity msg = createContactMessage();
        mockMvc.perform(patch("/api/v1/admin/contact-messages/" + msg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void updateContact_editorLacksContactWrite_returns403() throws Exception {
        ContactMessageEntity msg = createContactMessage();
        mockMvc.perform(patch("/api/v1/admin/contact-messages/" + msg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"IN_PROGRESS\"}")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void updateContact_statusNoteAssignee_writesAuditLog() throws Exception {
        ContactMessageEntity msg = createContactMessage();

        mockMvc.perform(patch("/api/v1/admin/contact-messages/" + msg.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"IN_PROGRESS","adminNote":"Đang xử lý",
                                 "assignedAdminId":"%s"}
                                """.formatted(adminId))
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        List<AuditLogEntity> logs =
                auditLogRepo.findByResourceTypeAndResourceId("CONTACT_MESSAGE", msg.getId());
        assertThat(logs).isNotEmpty();
        AuditLogEntity log = logs.get(logs.size() - 1);
        assertThat(log.getAction()).isEqualTo("CONTACT_MESSAGE_UPDATED");
        assertThat(log.getActorId()).isEqualTo(adminId);
        assertThat(log.getBeforeData()).contains("\"status\":\"OPEN\"");
        assertThat(log.getAfterData()).contains("\"status\":\"IN_PROGRESS\"");
        assertThat(log.getAfterData()).contains("\"adminNoteChanged\":true");
        // The customer's message body must never leak into the audit log.
        assertThat(log.getBeforeData()).doesNotContain("Nội dung tin nhắn khách");
        assertThat(log.getAfterData()).doesNotContain("Nội dung tin nhắn khách");
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ContactMessageEntity createContactMessage() {
        ContactMessageEntity m = new ContactMessageEntity();
        m.setFullName("Khách Test");
        m.setPhone("0900000000");
        m.setEmail("khach-" + UUID.randomUUID() + "@example.com");
        m.setContent("Nội dung tin nhắn khách - cần được giữ riêng tư");
        m.setStatus("OPEN");
        Instant now = Instant.now();
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        return contactRepo.save(m);
    }

    private AdminUserEntity ensureAdminUser(String email, String password, String role) {
        return adminUserRepo.findByEmail(email).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(email);
            admin.setPasswordHash(passwordService.hash(password));
            admin.setDisplayName("Contact Test " + role);
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
