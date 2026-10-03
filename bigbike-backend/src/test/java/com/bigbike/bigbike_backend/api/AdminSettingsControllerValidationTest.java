package com.bigbike.bigbike_backend.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.api.admin.AdminSettingsController;
import com.bigbike.bigbike_backend.api.common.ApiMetaFactory;
import com.bigbike.bigbike_backend.api.common.ApiResponseFactory;
import com.bigbike.bigbike_backend.api.error.GlobalExceptionHandler;
import com.bigbike.bigbike_backend.domain.auth.AdminUserProfile;
import com.bigbike.bigbike_backend.service.admin.SettingsTestFixture;
import com.bigbike.bigbike_backend.service.auth.DevAdminAuthService;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class AdminSettingsControllerValidationTest {
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        var fixture = new SettingsTestFixture();
        fixture.setting("hero_news_title", "Tin tức", null);
        fixture.setting("hero_news_image_url", "/media/original.png", null);
        fixture.setting("site_name", "BigBike", "BigBike");
        var auth = mock(DevAdminAuthService.class);
        when(auth.requirePermission(any(), eq("settings.write"))).thenReturn(new AdminUserProfile(
                "test-admin", "Test", "test@example.invalid", List.of("SUPER_ADMIN"), List.of("*"), "ACTIVE", Instant.now(), Instant.now()));
        var meta = new ApiMetaFactory();
        mvc = MockMvcBuilders.standaloneSetup(new AdminSettingsController(fixture.service, auth, new ApiResponseFactory(meta)))
                .setControllerAdvice(new GlobalExceptionHandler(meta)).build();
    }

    @Test
    void imageServiceValidationReturnsIndexedFieldInTheStandardEnvelope() throws Exception {
        mvc.perform(patch("/api/v1/admin/settings").contentType(MediaType.APPLICATION_JSON).content("""
                {"updates":[{"key":"hero_news_title","value":"New title"},
                {"key":"hero_news_image_url","value":"https://example.com/banner.png"}]}
                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("updates[1].value"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void requiredEnglishServiceValidationReturnsIndexedLanguage() throws Exception {
        mvc.perform(patch("/api/v1/admin/settings").contentType(MediaType.APPLICATION_JSON).content("""
                {"updates":[{"key":"hero_news_title","value":"New title"},
                {"key":"site_name","valueEn":""}]}
                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("updates[1].valueEn"))
                .andExpect(jsonPath("$.error.details[0].code").value("REQUIRED"));
    }

    @Test
    void dtoSizeValidationAlsoPreservesTheItemIndex() throws Exception {
        mvc.perform(patch("/api/v1/admin/settings").contentType(MediaType.APPLICATION_JSON)
                .content("{\"updates\":[{\"key\":\"hero_news_title\",\"valueEn\":\"" + "x".repeat(50001) + "\"}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("updates[0].valueEn"));
    }
}
