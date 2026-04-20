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
class PublicReadApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldReturnProductListWithPaginationAndMeta() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("page", "1")
                        .param("size", "2")
                .param("sort", "price:asc")
                .param("category", "mu-bao-hiem")
                .param("brand", "ls2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[0].image.url").exists())
                .andExpect(jsonPath("$.data[0].gallery").isArray())
                .andExpect(jsonPath("$.data[0].videos").isArray())
                .andExpect(jsonPath("$.data[0].price.currency").value("VND"))
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(2))
                .andExpect(jsonPath("$.meta.requestId").exists())
                .andExpect(jsonPath("$.meta.timestamp").exists());
    }

    @Test
    void shouldValidateUnsupportedSort() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("sort", "unknown:desc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("sort"))
                .andExpect(jsonPath("$.error.details[0].code").value("UNSUPPORTED_SORT_FIELD"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldReturnNotFoundForUnknownProductSlug() throws Exception {
        mockMvc.perform(get("/api/v1/products/not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.error.message").value("Product not found."));
    }

    @Test
    void shouldReturnCategoryAndBrandDetailBySlug() throws Exception {
        mockMvc.perform(get("/api/v1/categories/mu-bao-hiem"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("mu-bao-hiem"));

        mockMvc.perform(get("/api/v1/brands/ls2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("ls2"));
    }

    @Test
    void shouldReturnArticleAndPageBySlug() throws Exception {
        mockMvc.perform(get("/api/v1/articles/chon-mu-fullface-phu-hop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("chon-mu-fullface-phu-hop"));

        mockMvc.perform(get("/api/v1/pages/chinh-sach-bao-hanh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("chinh-sach-bao-hanh"));
    }
}
