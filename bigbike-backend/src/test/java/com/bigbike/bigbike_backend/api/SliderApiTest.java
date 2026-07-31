package com.bigbike.bigbike_backend.api;

import static org.hamcrest.Matchers.containsString;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
    void createSlider_requiresProductId() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": 9990,
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("productId"));
    }

    @Test
    void createSlider_rejectsNonHomeLocation() throws Exception {
        // Chỉ còn vị trí 'home' cho bản ghi mới (owner decision 2026-07-15, AUD-063).
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "category",
                                  "sortOrder": 9991,
                                  "productId": "prod_ls2_ff800",
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("location"));
    }

    @Test
    void createSlider_acceptsLinkedProduct() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": 9992,
                                  "productId": "prod_ls2_ff800",
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.productId").value("prod_ls2_ff800"))
                .andExpect(jsonPath("$.data.externalLink").doesNotExist());
    }

    @Test
    void createSlider_requiresProductAndMediaReadPermissions() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": 29992,
                                  "productId": "prod_ls2_ff800",
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isForbidden());
    }

    @Test
    void createSlider_rejectsDuplicateLocationSortOrder() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": 0,
                                  "productId": "prod_ls2_ff800",
                                  "isActive": true
                                }
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void createSlider_rejectsUnknownProductId() throws Exception {
        mockMvc.perform(post("/api/v1/admin/sliders")
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": 9993,
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
    void patchSlider_fullEdit_roundTripsMobileImageUrlAndAlt() throws Exception {
        String id = "slider_mobile_roundtrip_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        int sortOrder = 20_000 + Math.floorMod(id.hashCode(), 10_000);
        SliderEntity entity = slider("home", sortOrder, true, "/mobile-roundtrip");
        entity.setId(id);
        sliderJpaRepository.save(entity);

        mockMvc.perform(patch("/api/v1/admin/sliders/" + id)
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": %d,
                                  "desktopImage": {
                                    "url": "/media/sliders/desktop-roundtrip.jpg",
                                    "alt": "Ảnh desktop"
                                  },
                                  "mobileImage": {
                                    "url": "/media/sliders/mobile-roundtrip.jpg",
                                    "alt": "Ảnh mobile"
                                  },
                                  "productId": "prod_ls2_ff800",
                                  "isActive": true
                                }
                                """.formatted(sortOrder)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mobileImage.url").value("/media/sliders/mobile-roundtrip.jpg"))
                .andExpect(jsonPath("$.data.mobileImage.alt").value("Ảnh mobile"));

        ImageAsset mobileImage = sliderJpaRepository.findById(id).orElseThrow().getMobileImage();
        assertThat(mobileImage.url()).isEqualTo("/media/sliders/mobile-roundtrip.jpg");
        assertThat(mobileImage.alt()).isEqualTo("Ảnh mobile");
        assertThat(sliderJpaRepository.findById(id).orElseThrow().getExternalLink()).isEqualTo("/mobile-roundtrip");
    }

    @Test
    void patchSlider_fullEdit_requiresProductId() throws Exception {
        String id = "slider_product_required_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        int sortOrder = 25_000 + Math.floorMod(id.hashCode(), 10_000);
        SliderEntity entity = slider("home", sortOrder, true, "/legacy");
        entity.setId(id);
        sliderJpaRepository.save(entity);

        mockMvc.perform(patch("/api/v1/admin/sliders/" + id)
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": %d,
                                  "isActive": true
                                }
                                """.formatted(sortOrder)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.details[0].field").value("productId"));
    }

    @Test
    void patchSlider_fullEditWithNullMobileImage_clearsStoredImage() throws Exception {
        String id = "slider_mobile_clear_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        int sortOrder = 30_000 + Math.floorMod(id.hashCode(), 10_000);
        SliderEntity entity = slider("home", sortOrder, true, "/mobile-clear");
        entity.setId(id);
        entity.setMobileImage(new ImageAsset(
                null,
                "/media/sliders/mobile-before-clear.jpg",
                "Ảnh mobile cũ",
                780,
                1040,
                "image/jpeg"
        ));
        sliderJpaRepository.save(entity);

        mockMvc.perform(patch("/api/v1/admin/sliders/" + id)
                        .header("X-Admin-Permissions", "sliders.write,products.read,media.read")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "location": "home",
                                  "sortOrder": %d,
                                  "desktopImage": {
                                    "url": "/media/sliders/desktop-after-clear.jpg",
                                    "alt": "Ảnh desktop"
                                  },
                                  "mobileImage": null,
                                  "productId": "prod_ls2_ff800",
                                  "isActive": true
                                }
                """.formatted(sortOrder)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mobileImage").doesNotExist())
                .andExpect(content().string(containsString("\"mobileImage\":null")));

        assertThat(sliderJpaRepository.findById(id).orElseThrow().getMobileImage()).isNull();
    }

    @Test
    void publicSliders_returnsOnlyActiveRows() throws Exception {
        String location = "audit-public-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        sliderJpaRepository.save(slider(location, 0, true, "/visible"));
        sliderJpaRepository.save(slider(location, 1, false, "/hidden"));

        mockMvc.perform(get("/api/v1/sliders").param("location", location))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].externalLink").value("/visible"))
                .andExpect(jsonPath("$.data[0].link").doesNotExist());
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
