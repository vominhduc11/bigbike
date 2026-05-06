package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ContentPublicApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldListPublishedArticlesWithPagination() throws Exception {
        // Use category filter to get a stable, predictable count from seed data
        mockMvc.perform(get("/api/v1/articles")
                        .param("category", "trai-nghiem")
                        .param("page", "1")
                        .param("size", "2")
                        .param("sort", "publishedAt:desc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(2))
                .andExpect(jsonPath("$.pagination.totalItems").value(3))
                .andExpect(jsonPath("$.pagination.totalPages").value(2))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldFilterArticlesByCategorySlug() throws Exception {
        mockMvc.perform(get("/api/v1/articles")
                        .param("category", "trai-nghiem")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.totalItems").value(3));

        mockMvc.perform(get("/api/v1/articles")
                        .param("category", "blog")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(3));
    }

    @Test
    void shouldSearchArticlesByQuery() throws Exception {
        mockMvc.perform(get("/api/v1/articles")
                        .param("q", "fullface"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].slug").value("chon-mu-fullface-phu-hop"));
    }

    @Test
    void shouldExcludeDraftArticlesFromPublicListing() throws Exception {
        mockMvc.perform(get("/api/v1/articles")
                        .param("q", "nhap")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(0));
    }

    @Test
    void shouldReturnPublishedArticleBySlug() throws Exception {
        mockMvc.perform(get("/api/v1/articles/chon-mu-fullface-phu-hop"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("article_chon_mu_fullface"))
                .andExpect(jsonPath("$.data.slug").value("chon-mu-fullface-phu-hop"))
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldReturn404ForUnknownArticleSlug() throws Exception {
        mockMvc.perform(get("/api/v1/articles/slug-khong-ton-tai"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void shouldReturn404ForDraftArticleSlug() throws Exception {
        mockMvc.perform(get("/api/v1/articles/bai-viet-nhap-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void shouldReturnPublishedPageBySlug() throws Exception {
        mockMvc.perform(get("/api/v1/pages/chinh-sach-bao-hanh"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("page_chinh_sach_bao_hanh"))
                .andExpect(jsonPath("$.data.slug").value("chinh-sach-bao-hanh"))
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldReturn404ForUnknownPageSlug() throws Exception {
        mockMvc.perform(get("/api/v1/pages/trang-khong-ton-tai"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void shouldReturn404ForDraftPageSlug() throws Exception {
        mockMvc.perform(get("/api/v1/pages/trang-nhap-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("NOT_FOUND"));
    }

    @Test
    void shouldValidateInvalidSortField() throws Exception {
        mockMvc.perform(get("/api/v1/articles")
                        .param("sort", "unknown:desc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
