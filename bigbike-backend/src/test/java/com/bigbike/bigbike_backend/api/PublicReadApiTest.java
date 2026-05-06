package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class PublicReadApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    @Disabled("Requires V1000 catalog seed (disabled) — data not available in H2 test context")
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
    @Disabled("Requires V1000 catalog seed (disabled) — data not available in H2 test context")
    void shouldFilterProductsByLegacyQueryParams() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("page", "1")
                        .param("size", "10")
                        .param("pwb-brand", "ls2")
                        .param("filter_color", "do")
                        .param("min_price", "3000000")
                        .param("max_price", "3400000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].slug").value("mu-bao-hiem-ls2-ff800"));
    }

    @Test
    void shouldValidateInvalidLegacyPriceRange() throws Exception {
        mockMvc.perform(get("/api/v1/products")
                        .param("min_price", "5000000")
                        .param("max_price", "1000000"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("min_price"))
                .andExpect(jsonPath("$.error.details[0].code").value("INVALID_RANGE"));
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
    @Disabled("Requires V1000 catalog seed (disabled) — data not available in H2 test context")
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
                .andExpect(jsonPath("$.data.slug").value("chon-mu-fullface-phu-hop"))
                .andExpect(jsonPath("$.meta.requestId").exists());

        mockMvc.perform(get("/api/v1/pages/chinh-sach-bao-hanh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value("chinh-sach-bao-hanh"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }
}
