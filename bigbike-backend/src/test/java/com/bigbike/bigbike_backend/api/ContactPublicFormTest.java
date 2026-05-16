package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.contact.ContactMessageEntity;
import com.bigbike.bigbike_backend.persistence.repository.contact.ContactMessageJpaRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Covers FULL-12 batch 2: public contact form — submit, validation, no auth required.
 * Endpoint: POST /api/v1/contact (ContactController → ContactService).
 * Email send is best-effort; mail not configured in tests so it is silently skipped.
 */
@SpringBootTest
class ContactPublicFormTest {

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ContactMessageJpaRepository contactRepo;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // ── 1. Valid submission ───────────────────────────────────────────────────

    @Test
    void submitContactForm_valid_returns201AndPersistedWithOpenStatus() throws Exception {
        String phone = "090" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);

        mockMvc.perform(post("/api/v1/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Nguyen Van Test\",\"phone\":\"" + phone + "\","
                                + "\"content\":\"Toi can ho tro ve san pham.\"}"))
                .andExpect(status().isCreated());

        Optional<ContactMessageEntity> saved = contactRepo.findAll().stream()
                .filter(m -> phone.equals(m.getPhone()))
                .findFirst();
        assertThat(saved).isPresent();
        assertThat(saved.get().getStatus()).isEqualTo("OPEN");
        assertThat(saved.get().getFullName()).isEqualTo("Nguyen Van Test");
        assertThat(saved.get().getContent()).isNotBlank();
    }

    @Test
    void submitContactForm_withOptionalEmail_returns201AndEmailPersisted() throws Exception {
        String phone   = "091" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String email   = "contact-" + UUID.randomUUID() + "@example.com";

        mockMvc.perform(post("/api/v1/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Tran Thi Email\",\"phone\":\"" + phone + "\","
                                + "\"email\":\"" + email + "\",\"content\":\"Ho tro ky thuat.\"}"))
                .andExpect(status().isCreated());

        Optional<ContactMessageEntity> saved = contactRepo.findAll().stream()
                .filter(m -> phone.equals(m.getPhone()))
                .findFirst();
        assertThat(saved).isPresent();
        assertThat(saved.get().getEmail()).isEqualTo(email);
    }

    // ── 2. No auth required ───────────────────────────────────────────────────

    @Test
    void submitContactForm_publicEndpoint_noAuthNoCookiesRequired() throws Exception {
        // No Authorization header, no session cookie — public endpoint must accept the request.
        mockMvc.perform(post("/api/v1/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Public User\","
                                + "\"phone\":\"0909000777\",\"content\":\"Test.\"}"))
                .andExpect(status().isCreated());
    }

    // ── 3. Validation — missing required fields ──────────────────────────────

    @Test
    void submitContactForm_missingFullName_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"0909000222\",\"content\":\"No fullName.\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitContactForm_missingPhone_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Some User\",\"content\":\"No phone.\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitContactForm_missingContent_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/contact")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Some User\",\"phone\":\"0909000333\"}"))
                .andExpect(status().isBadRequest());
    }
}
