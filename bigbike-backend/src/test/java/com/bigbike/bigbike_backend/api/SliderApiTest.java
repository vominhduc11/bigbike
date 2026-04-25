package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
class SliderApiTest {

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void listHomeSliders_returnsEightCuratedSlidesInOrder() throws Exception {
        mockMvc.perform(get("/api/v1/sliders").param("location", "home"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(8))
                .andExpect(jsonPath("$.data[0].sortOrder").value(0))
                .andExpect(jsonPath("$.data[0].desktopImage.url").exists())
                .andExpect(jsonPath("$.data[0].product").exists())
                .andExpect(jsonPath("$.data[0].productLink").value("/sp/mu-bao-hiem-ls2-ff800.html"))
                .andExpect(jsonPath("$.data[0].link").value("/sp/mu-bao-hiem-ls2-ff800.html"))
                .andExpect(jsonPath("$.data[2].mobileImage").doesNotExist())
                .andExpect(jsonPath("$.data[7].product").doesNotExist())
                .andExpect(jsonPath("$.data[7].externalLink").isNotEmpty())
                .andExpect(jsonPath("$.data[7].link").value("https://bigbike.vn/tai-nghe-bluetooth-gan-mu-bao-hiem.html?pwb-brand=scs"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void listHomeSliders_rejectsInvalidLocation() throws Exception {
        mockMvc.perform(get("/api/v1/sliders").param("location", "../home"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
