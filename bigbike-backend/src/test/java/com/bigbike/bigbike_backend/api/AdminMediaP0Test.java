package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import com.bigbike.bigbike_backend.service.auth.PasswordService;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@TestPropertySource(properties = "bigbike.auth.dev-header-enabled=false")
class AdminMediaP0Test {

    // Minimal PNG: 8-byte signature + IHDR — enough for Tika magic-byte detection
    private static final byte[] PNG_BYTES = {
        (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n',
        0x00, 0x00, 0x00, 0x0D, 'I', 'H', 'D', 'R',
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, (byte) 0x90, 0x77, 0x53, (byte) 0xDE
    };

    private static final String ADMIN_EMAIL = "p0media-" + UUID.randomUUID() + "@bigbike.test";
    private static final String ADMIN_PASS  = "Admin@P0Test1234";

    @MockitoBean
    MinioClient minioClient;

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired AdminUserJpaRepository adminUserRepo;
    @Autowired MediaJpaRepository mediaRepo;
    @Autowired BrandJpaRepository brandRepo;
    @Autowired PasswordService passwordService;

    private MockMvc mockMvc;
    private String adminToken;

    @BeforeEach
    void setup() throws Exception {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
        ensureAdminUser();
        adminToken = loginAdmin();
    }

    // ── Upload ────────────────────────────────────────────────────────────────

    @Test
    void upload_validPng_returns201() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "photo.png", "image/png", PNG_BYTES);

        mockMvc.perform(multipart("/api/v1/admin/media")
                        .file(file)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.mimeType").value("image/png"));
    }

    @Test
    void upload_svgFile_returns400() throws Exception {
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "evil.svg", "image/svg+xml", svg);

        mockMvc.perform(multipart("/api/v1/admin/media")
                        .file(file)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void upload_fakeMimeType_returns400() throws Exception {
        // Claims image/jpeg but content is plain text — Tika detects text/plain → rejected
        byte[] text = "This is not an image, just text content.".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "fake.jpg", "image/jpeg", text);

        mockMvc.perform(multipart("/api/v1/admin/media")
                        .file(file)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void upload_emptyFile_returns400() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "empty.png", "image/png", new byte[0]);

        mockMvc.perform(multipart("/api/v1/admin/media")
                        .file(file)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void upload_unsupportedMimeType_returns400() throws Exception {
        byte[] pdf = "%PDF-1.4 fake content".getBytes();
        MockMultipartFile file = new MockMultipartFile(
                "file", "doc.pdf", "application/pdf", pdf);

        mockMvc.perform(multipart("/api/v1/admin/media")
                        .file(file)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    // ── Permission ────────────────────────────────────────────────────────────

    @Test
    void mutation_withoutToken_returns401() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.png", "image/png", PNG_BYTES);

        mockMvc.perform(multipart("/api/v1/admin/media").file(file))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void mutation_devHeaderOnly_returns401WhenFlagDisabled() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "test.png", "image/png", PNG_BYTES);

        // X-Admin-Role header bypass is disabled (bigbike.auth.dev-header-enabled=false)
        mockMvc.perform(multipart("/api/v1/admin/media")
                        .file(file)
                        .header("X-Admin-Role", "ADMIN")
                        .header("X-Admin-Permissions", "media.write"))
                .andExpect(status().isUnauthorized());
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    @Test
    void hardDelete_noRefs_returns204() throws Exception {
        UUID mediaId = createTestMedia("/media/uploads/test-" + UUID.randomUUID() + "/img.jpg");

        mockMvc.perform(delete("/api/v1/admin/media/" + mediaId)
                        .param("permanent", "true")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        assertThat(mediaRepo.findById(mediaId)).isEmpty();
    }

    @Test
    void hardDelete_withRefs_returns409() throws Exception {
        String publicUrl = "/media/uploads/ref-" + UUID.randomUUID() + "/img.jpg";
        UUID mediaId = createTestMedia(publicUrl);

        BrandEntity brand = new BrandEntity();
        brand.setId("bref-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        brand.setSlug("brand-ref-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8));
        brand.setName("Test Brand Ref");
        brand.setLogoUrl(publicUrl);
        brand.setVisible(true);
        Instant now = Instant.now();
        brand.setCreatedAt(now);
        brand.setUpdatedAt(now);
        brandRepo.save(brand);

        mockMvc.perform(delete("/api/v1/admin/media/" + mediaId)
                        .param("permanent", "true")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict());

        assertThat(mediaRepo.findById(mediaId)).isPresent();
    }

    @Test
    void hardDelete_storageFailure_keepsDbRow() throws Exception {
        UUID mediaId = createTestMedia("/media/uploads/fail-" + UUID.randomUUID() + "/img.jpg");
        doThrow(new Exception("MinIO unavailable"))
                .when(minioClient).removeObject(any(RemoveObjectArgs.class));

        mockMvc.perform(delete("/api/v1/admin/media/" + mediaId)
                        .param("permanent", "true")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isInternalServerError());

        assertThat(mediaRepo.findById(mediaId)).isPresent();
    }

    @Test
    void softDelete_marksDeleted() throws Exception {
        UUID mediaId = createTestMedia("/media/uploads/soft-" + UUID.randomUUID() + "/img.jpg");

        mockMvc.perform(delete("/api/v1/admin/media/" + mediaId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());

        assertThat(mediaRepo.findById(mediaId))
                .isPresent()
                .get()
                .extracting(MediaEntity::getStatus)
                .isEqualTo("DELETED");
    }

    @Test
    void restore_changesStatusToActive() throws Exception {
        UUID mediaId = createTestMedia("/media/uploads/restore-" + UUID.randomUUID() + "/img.jpg");
        mediaRepo.findById(mediaId).ifPresent(m -> {
            m.setStatus("DELETED");
            mediaRepo.save(m);
        });

        mockMvc.perform(post("/api/v1/admin/media/" + mediaId + "/restore")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void ensureAdminUser() {
        adminUserRepo.findByEmail(ADMIN_EMAIL).orElseGet(() -> {
            AdminUserEntity admin = new AdminUserEntity();
            admin.setEmail(ADMIN_EMAIL);
            admin.setPasswordHash(passwordService.hash(ADMIN_PASS));
            admin.setDisplayName("P0 Media Test Admin");
            admin.setRole("ADMIN");
            admin.setStatus("ACTIVE");
            Instant now = Instant.now();
            admin.setCreatedAt(now);
            admin.setUpdatedAt(now);
            return adminUserRepo.save(admin);
        });
    }

    private String loginAdmin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + ADMIN_EMAIL + "\",\"password\":\"" + ADMIN_PASS + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        String marker = "\"accessToken\":\"";
        int start = body.indexOf(marker) + marker.length();
        return body.substring(start, body.indexOf("\"", start));
    }

    private UUID createTestMedia(String publicUrl) {
        MediaEntity m = new MediaEntity();
        m.setFilePath(publicUrl.replaceFirst("^/media/", ""));
        m.setPublicUrl(publicUrl);
        m.setStorageProvider("MINIO");
        m.setMimeType("image/jpeg");
        m.setFileSize(10000L);
        m.setAltText("Test image");
        m.setTitle("Test");
        m.setStatus("ACTIVE");
        Instant now = Instant.now();
        m.setCreatedAt(now);
        m.setUpdatedAt(now);
        return mediaRepo.save(m).getId();
    }
}
