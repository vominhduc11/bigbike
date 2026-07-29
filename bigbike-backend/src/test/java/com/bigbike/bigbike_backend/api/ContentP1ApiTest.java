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

    // ── P1-003: category_map sync on PATCH ───────────────────────────────────

    @Test
    void shouldSyncCategoryMapAfterArticleCategoryPatch() throws Exception {
        long ts = System.currentTimeMillis();
        String slug = "p1-003-cat-sync-" + ts;
        // Use a unique phrase in the title so q-filter works (public API searches title, not slug)
        String uniqueMarker = "CatSyncP1003x" + ts;
        String title = "Category Sync Test " + uniqueMarker;

        // 0. Target = seeded cc_blog. (The admin create-content-category endpoint was
        //    removed together with the authors CRUD — categories are fixed seed/ops data.)
        String targetCatSlug = "blog";
        String targetCatId = "cc_blog";

        // 1. Create article with source category cc_trai_nghiem
        String createPayload = """
                {
                  "slug": "%s",
                  "title": "%s",
                  "body": "<p>test</p>",
                  "categoryId": "cc_trai_nghiem",
                  "publishStatus": "PUBLISHED",
                  "translations": { "en": { "title": "%s EN" } }
                }
                """.formatted(slug, title, title);

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

    // (Author CRUD + admin create-content-category tests removed: the
    //  /admin/content/authors and /admin/content/content-categories endpoints no longer
    //  exist — stale expectations cleaned per AUD-046. The reference/categories endpoint
    //  and its tests were removed 2026-07-15 per AUD-056 — no caller since V275.)

    // ── Article productImage whitelist (audit module Tin tức 2026-07-29) ─────────
    // MEDIA_RULE_002: coverImage was whitelisted, productImage was not — an admin could
    // save an article product image pointing at an external host. Now both are guarded.
    @Test
    void articleProductImageShouldRejectUrlOutsideTheMediaLibrary() throws Exception {
        long ts = System.currentTimeMillis();
        String slug = "product-image-external-" + ts;

        String payload = """
                {
                  "slug": "%s",
                  "title": "Ảnh sản phẩm ngoài %s",
                  "body": "<p>test</p>",
                  "categoryId": "cc_blog",
                  "publishStatus": "DRAFT",
                  "translations": { "en": { "title": "External product image %s" } },
                  "productImage": { "url": "https://cdn.ben-thu-ba.com/product.jpg" }
                }
                """.formatted(slug, ts, ts);

        mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.error.details[0].field").value("productImage.url"))
                .andExpect(jsonPath("$.error.details[0].code").value("INVALID_VALUE"));
    }

    @Test
    void articleProductImageFromMediaLibraryShouldSaveWithAltText() throws Exception {
        long ts = System.currentTimeMillis();
        String slug = "product-image-ok-" + ts;

        String payload = """
                {
                  "slug": "%s",
                  "title": "Ảnh sản phẩm nội bộ %s",
                  "body": "<p>test</p>",
                  "categoryId": "cc_blog",
                  "publishStatus": "DRAFT",
                  "translations": { "en": { "title": "Internal product image %s" } },
                  "coverImage": { "url": "/media/articles/cover.jpg", "alt": "Ảnh bìa" },
                  "productImage": { "url": "/media/articles/product.jpg", "alt": "Ảnh sản phẩm trong bài" }
                }
                """.formatted(slug, ts, ts);

        mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.coverImage.alt").value("Ảnh bìa"))
                .andExpect(jsonPath("$.data.productImage.alt").value("Ảnh sản phẩm trong bài"));
    }

    @Test
    void articleVideoBlockAcceptsYoutubeAndUploadOnly() throws Exception {
        long ts = System.currentTimeMillis();

        for (String[] source : new String[][] {
                { "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
                { "upload", "/media/articles/demo.mp4" }
        }) {
            String payload = """
                    {
                      "slug": "article-video-%s-%s",
                      "title": "Video bài viết %s",
                      "categoryId": "cc_blog",
                      "publishStatus": "DRAFT",
                      "translations": { "en": { "title": "Article video %s" } },
                      "bodyBlocks": [
                        { "type": "video", "provider": "%s", "url": "%s" }
                      ]
                    }
                    """.formatted(source[0], ts, source[0], source[0], source[0], source[1]);

            mockMvc.perform(post("/api/v1/admin/content/articles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .characterEncoding(StandardCharsets.UTF_8)
                            .header("X-Admin-Permissions", "content.update")
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.bodyBlocks[0].provider").value(source[0]));
        }

        for (String[] legacy : new String[][] {
                { "tiktok", "https://www.tiktok.com/@bigbike/video/7251234567890123456" },
                { "facebook", "https://www.facebook.com/BigBike/videos/1234567890" }
        }) {
            String payload = """
                    {
                      "slug": "article-video-legacy-%s-%s",
                      "title": "Video legacy %s",
                      "categoryId": "cc_blog",
                      "publishStatus": "DRAFT",
                      "translations": { "en": { "title": "Legacy video %s" } },
                      "bodyBlocks": [
                        { "type": "video", "provider": "%s", "url": "%s" }
                      ]
                    }
                    """.formatted(legacy[0], ts, legacy[0], legacy[0], legacy[0], legacy[1]);

            mockMvc.perform(post("/api/v1/admin/content/articles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .characterEncoding(StandardCharsets.UTF_8)
                            .header("X-Admin-Permissions", "content.update")
                            .content(payload))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        }
    }
}
