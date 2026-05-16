package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * P1 regression tests for Content / Blog / Page module:
 *   P1-003 — article_category_map must stay in sync after PATCH categoryId
 *   P1-005 — GET /api/v1/pages returns all published pages
 *   P1-007 — admin reference endpoints + author/category CRUD
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ContentP1ApiTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    // ── P1-005: public pages list ─────────────────────────────────────────────

    @Test
    void shouldListPublishedPagesFromPublicEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/pages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                // Verify specific seeded published pages are present; do not assert exact total
                // because other tests may create pages. Draft page_draft_1 must be excluded.
                .andExpect(jsonPath("$.data[?(@.slug == 'gioi-thieu')]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.slug == 'chinh-sach-bao-hanh')]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.slug == 'trang-nhap-1')]").isEmpty())
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldExcludeDraftPagesFromPublicList() throws Exception {
        // page_draft_1 has slug "trang-nhap-1" — must not appear
        mockMvc.perform(get("/api/v1/pages"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == 'trang-nhap-1')]").isEmpty());
    }

    // ── P1-003: category_map sync on PATCH ───────────────────────────────────

    @Test
    void shouldSyncCategoryMapAfterArticleCategoryPatch() throws Exception {
        long ts = System.currentTimeMillis();
        String slug = "p1-003-cat-sync-" + ts;
        // Use a unique phrase in the title so q-filter works (public API searches title, not slug)
        String uniqueMarker = "CatSyncP1003x" + ts;
        String title = "Category Sync Test " + uniqueMarker;

        // 0. Create an isolated target category so we don't pollute seeded counts
        String targetCatSlug = "p1-003-target-" + ts;
        String catPayload = """
                {
                  "slug": "%s",
                  "name": "P1003 Target Cat %d"
                }
                """.formatted(targetCatSlug, ts);

        MvcResult catResult = mockMvc.perform(post("/api/v1/admin/content/content-categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(catPayload))
                .andExpect(status().isOk())
                .andReturn();

        String targetCatId = objectMapper.readTree(
                catResult.getResponse().getContentAsString()).at("/data/id").asText();

        // 1. Create article with source category cc_trai_nghiem
        String createPayload = """
                {
                  "slug": "%s",
                  "title": "%s",
                  "body": "<p>test</p>",
                  "categoryId": "cc_trai_nghiem",
                  "publishStatus": "PUBLISHED"
                }
                """.formatted(slug, title);

        MvcResult createResult = mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andReturn();

        String articleId = objectMapper.readTree(
                createResult.getResponse().getContentAsString()).at("/data/id").asText();

        // 2. Verify article appears in trai-nghiem public filter (q matches title)
        mockMvc.perform(get("/api/v1/articles")
                        .param("category", "trai-nghiem")
                        .param("q", uniqueMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(1));

        // 3. PATCH: change category to the isolated target category
        String patchPayload = """
                {
                  "categoryId": "%s"
                }
                """.formatted(targetCatId);

        mockMvc.perform(patch("/api/v1/admin/content/articles/{id}", articleId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(patchPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(articleId));

        // 4. Article must now appear in target category filter (new category)
        mockMvc.perform(get("/api/v1/articles")
                        .param("category", targetCatSlug)
                        .param("q", uniqueMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(1));

        // 5. Article must no longer appear in trai-nghiem filter (old category cleared from join table)
        mockMvc.perform(get("/api/v1/articles")
                        .param("category", "trai-nghiem")
                        .param("q", uniqueMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(0));
    }

    // ── P1-007: admin reference endpoints ────────────────────────────────────

    @Test
    void shouldListContentCategoriesViaReferenceEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content/reference/categories")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                // seed has cc_trai_nghiem and cc_blog
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[?(@.slug == 'trai-nghiem')].name").value("Trai nghiem"))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldListAuthorsViaReferenceEndpoint() throws Exception {
        // no authors seeded — endpoint must return empty array (not 404/500)
        mockMvc.perform(get("/api/v1/admin/content/reference/authors")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldListPageRefsViaReferenceEndpoint() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content/reference/pages")
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                // All pages (published + draft) must appear; do not assert exact count
                // because other tests may create pages.
                .andExpect(jsonPath("$.data[?(@.slug == 'gioi-thieu')]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.slug == 'chinh-sach-bao-hanh')]").isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.slug == 'trang-nhap-1')]").isNotEmpty())
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldRejectReferenceEndpointWithoutContentReadPermission() throws Exception {
        mockMvc.perform(get("/api/v1/admin/content/reference/categories")
                        .header("X-Admin-Permissions", "products.read"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void shouldCreateAuthorAndReturnIt() throws Exception {
        long ts = System.currentTimeMillis();
        String payload = """
                {
                  "name": "Test Author %d"
                }
                """.formatted(ts);

        mockMvc.perform(post("/api/v1/admin/content/authors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.name").value("Test Author " + ts))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldCreateContentCategoryAndReturnIt() throws Exception {
        long ts = System.currentTimeMillis();
        String slug = "new-cat-" + ts;
        String payload = """
                {
                  "slug": "%s",
                  "name": "New Category %d"
                }
                """.formatted(slug, ts);

        mockMvc.perform(post("/api/v1/admin/content/content-categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").exists())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.name").value("New Category " + ts))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldRejectDuplicateCategorySlug() throws Exception {
        // "trai-nghiem" is already seeded via cc_trai_nghiem
        String payload = """
                {
                  "slug": "trai-nghiem",
                  "name": "Duplicate"
                }
                """;

        mockMvc.perform(post("/api/v1/admin/content/content-categories")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("slug"));
    }

    @Test
    void shouldRejectCreateAuthorWithoutPermission() throws Exception {
        mockMvc.perform(post("/api/v1/admin/content/authors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.read")
                        .content("""
                                { "name": "No Permission Author" }
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
    }

    @Test
    void shouldRejectBlankAuthorName() throws Exception {
        mockMvc.perform(post("/api/v1/admin/content/authors")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("""
                                { "name": "" }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
