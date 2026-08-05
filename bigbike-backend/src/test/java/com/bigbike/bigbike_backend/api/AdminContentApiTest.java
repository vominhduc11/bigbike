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
class AdminContentApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldListArticlesAsAdminWithPagination() throws Exception {
        // "trai-nghiem" matches slugs of article_trai_nghiem_2 and article_trai_nghiem_3 (2 items)
        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "ARTICLE")
                        .param("q", "trai-nghiem")
                        .param("page", "1")
                        .param("size", "1")
                        .param("sort", "createdAt:desc")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(1))
                .andExpect(jsonPath("$.pagination.totalItems").value(2))
                .andExpect(jsonPath("$.pagination.totalPages").value(2))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldFilterArticlesByPublishStatus() throws Exception {
        // "nhap" matches slug/title of the seeded DRAFT article
        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "ARTICLE")
                        .param("publishStatus", "DRAFT")
                        .param("q", "nhap")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(1));

        // "trai-nghiem" matches slugs of 2 seeded PUBLISHED articles
        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "ARTICLE")
                        .param("publishStatus", "PUBLISHED")
                        .param("q", "trai-nghiem")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(2));
    }

    @Test
    @Sql(
            statements = "INSERT INTO articles (id, slug, title, body, publish_status, created_at, updated_at, featured, seo_no_index, home_experience) VALUES ('article_trash_contract', 'article-trash-contract', 'Article trash contract', '<p>Trash.</p>', 'TRASH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, false, false, false)",
            executionPhase = Sql.ExecutionPhase.BEFORE_TEST_METHOD)
    @Sql(
            statements = "DELETE FROM articles WHERE id = 'article_trash_contract'",
            executionPhase = Sql.ExecutionPhase.AFTER_TEST_METHOD)
    void shouldExcludeTrashByDefaultAndReturnItWhenExplicitlyFiltered() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content")
                        .param("q", "article-trash-contract")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(0));

        mockMvc.perform(get("/api/v1/admin/content")
                        .param("publishStatus", "TRASH")
                        .param("q", "article-trash-contract")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(1))
                .andExpect(jsonPath("$.data[0].publishStatus").value("TRASH"));
    }

    @Test
    void shouldListContentWithoutTypeFilter() throws Exception {
        // Module Trang đã gỡ — content giờ chỉ còn Bài viết (3 blog articles seed).
        mockMvc.perform(get("/api/v1/admin/content")
                        .param("q", "blog")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.totalItems").value(3));
    }

    @Test
    void shouldSearchArticlesByQuery() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "ARTICLE")
                        .param("q", "fullface")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value("article_chon_mu_fullface"));
    }

    @Test
    void shouldReturnArticleDetailWithNewFields() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content/article/article_chon_mu_fullface")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value("article_chon_mu_fullface"))
                .andExpect(jsonPath("$.data.type").value("ARTICLE"))
                .andExpect(jsonPath("$.data.slug").value("chon-mu-fullface-phu-hop"))
                .andExpect(jsonPath("$.data.publishStatus").value("PUBLISHED"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldReturnForbiddenWithoutContentReadPermission() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void shouldValidateInvalidContentType() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content")
                        .param("type", "INVALID")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("type"));
    }
}
