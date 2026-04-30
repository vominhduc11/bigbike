package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.persistence.entity.slider.SliderEntity;
import com.bigbike.bigbike_backend.persistence.repository.slider.SliderJpaRepository;
import java.time.Instant;
import java.util.UUID;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class SliderApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @Autowired
    private SliderJpaRepository sliderJpaRepository;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    private String loginAdmin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"admin@bigbike.vn\",\"password\":\"admin123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String body = result.getResponse().getContentAsString();
        int start = body.indexOf("\"accessToken\":\"") + 15;
        int end = body.indexOf('"', start);
        return body.substring(start, end);
    }

    @Test
    @Disabled("Requires V1000 product seed and V1002 slider seed which are currently disabled")
    void listHomeSliders_returnsEightCuratedSlidesInOrder() throws Exception {
        mockMvc.perform(get("/api/v1/sliders").param("location", "home"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", Matchers.containsString("max-age=300")))
                .andExpect(jsonPath("$.data.length()").value(8))
                .andExpect(jsonPath("$.data[0].sortOrder").value(0))
                .andExpect(jsonPath("$.data[0].desktopImage.url").exists())
                .andExpect(jsonPath("$.data[0].productLink").value("/sp/mu-bao-hiem-ls2-ff800.html"))
                .andExpect(jsonPath("$.data[0].link").value("/sp/mu-bao-hiem-ls2-ff800.html"))
                .andExpect(jsonPath("$.data[0].product").doesNotExist())
                .andExpect(jsonPath("$.data[2].mobileImage").doesNotExist())
                .andExpect(jsonPath("$.data[7].productLink").doesNotExist())
                .andExpect(jsonPath("$.data[7].externalLink").isNotEmpty())
                .andExpect(jsonPath("$.data[7].link").value("https://bigbike.vn/tai-nghe-bluetooth-gan-mu-bao-hiem.html?pwb-brand=scs"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void patchSlider_toggleActive_returns200() throws Exception {
        String id = "slider_patch_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        SliderEntity e = new SliderEntity();
        e.setId(id);
        e.setLocation("home");
        e.setSortOrder(999);
        e.setDesktopImage(new ImageAsset(null, "https://cdn.bigbike.local/test.jpg", "test", 1200, 600, "image/jpeg"));
        e.setExternalLink("https://bigbike.vn/test");
        e.setActive(true);
        e.setCreatedAt(Instant.now());
        e.setUpdatedAt(Instant.now());
        sliderJpaRepository.save(e);

        String token = loginAdmin();
        mockMvc.perform(patch("/api/v1/admin/sliders/" + id)
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isActive\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isActive").value(false));

        sliderJpaRepository.deleteById(id);
    }

    @Test
    void listHomeSliders_rejectsInvalidLocation() throws Exception {
        mockMvc.perform(get("/api/v1/sliders").param("location", "../home"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void listHomeSliders_setsCacheControlHeader() throws Exception {
        mockMvc.perform(get("/api/v1/sliders").param("location", "home"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", Matchers.containsString("max-age=300")))
                .andExpect(header().string("Cache-Control", Matchers.containsString("public")));
    }
}
