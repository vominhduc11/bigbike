package com.bigbike.bigbike_backend.api;

import static org.hamcrest.Matchers.containsString;
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
class SliderApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private SliderJpaRepository sliderJpaRepository;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .build();
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
                .andExpect(header().string("Cache-Control", containsString("max-age=300")))
                .andExpect(header().string("Cache-Control", containsString("public")));
    }

    @Test
    void createSlider_requiresProductIdOrExternalLink() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "audit-home",
                                  "sortOrder": 0,
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("link"));
    }

    @Test
    void createSlider_rejectsUnsafeExternalLink() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "audit-home",
                                  "sortOrder": 1,
                                  "externalLink": "javascript:alert(1)",
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("externalLink"));
    }

    @Test
    void createSlider_rejectsDuplicateLocationSortOrder() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": 0,
                                  "externalLink": "/tai-nghe-bluetooth-gan-mu-bao-hiem.html",
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void createSlider_rejectsUnknownProductId() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "audit-product",
                                  "sortOrder": 0,
                                  "productId": "prod_missing",
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void patchSlider_toggleActive_returns200() throws Exception {
        String id = "slider_patch_test_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        SliderEntity entity = new SliderEntity();
        entity.setId(id);
        entity.setLocation("home");
        entity.setSortOrder(999);
        entity.setDesktopImage(new ImageAsset(null, "/media/sliders/test.jpg", "test", 1200, 600, "image/jpeg"));
        entity.setExternalLink("/test");
        entity.setActive(true);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        sliderJpaRepository.save(entity);

        mockMvc.perform(patch("/api/v1/admin/sliders/" + id)
                        .header("X-Admin-Permissions", "sliders.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"isActive\": false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isActive").value(false));
    }

    @Test
    void publicSliders_returnsOnlyActiveRows() throws Exception {
        String location = "audit-public-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        sliderJpaRepository.save(slider(location, 0, true, "/visible"));
        sliderJpaRepository.save(slider(location, 1, false, "/hidden"));

        mockMvc.perform(get("/api/v1/sliders").param("location", location))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].externalLink").value("/visible"));
    }

    @Test
    void reorderSwap_doesNotViolateUniqueConstraint() throws Exception {
        String location = "audit-reorder-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        SliderEntity first = slider(location, 0, true, "/one");
        SliderEntity second = slider(location, 1, true, "/two");
        sliderJpaRepository.save(first);
        sliderJpaRepository.save(second);

        mockMvc.perform(post("/api/v1/admin/sliders/reorder")
                        .header("X-Admin-Permissions", "sliders.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "%s",
                                  "items": [
                                    { "id": "%s", "sortOrder": 1 },
                                    { "id": "%s", "sortOrder": 0 }
                                  ]
                                }
                                """.formatted(location, first.getId(), second.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(second.getId()))
                .andExpect(jsonPath("$.data[0].sortOrder").value(0))
                .andExpect(jsonPath("$.data[1].id").value(first.getId()))
                .andExpect(jsonPath("$.data[1].sortOrder").value(1));
    }

    private static SliderEntity slider(String location, int sortOrder, boolean isActive, String externalLink) {
        SliderEntity entity = new SliderEntity();
        entity.setId("slider_" + UUID.randomUUID().toString().replace("-", ""));
        entity.setLocation(location);
        entity.setSortOrder(sortOrder);
        entity.setDesktopImage(new ImageAsset(null, "/media/sliders/" + sortOrder + ".jpg", "Slide", 1200, 600, "image/jpeg"));
        entity.setExternalLink(externalLink);
        entity.setActive(isActive);
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        return entity;
    }
}
