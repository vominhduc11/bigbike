package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Regression tests for the Article module after content categories were removed.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class ContentP1ApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void articleApiDoesNotExposeContentCategoryFieldsOrEndpoint() throws Exception {
        long ts = System.currentTimeMillis();
        String slug = "content-category-removed-" + ts;
        String uniqueMarker = "NoContentCategory" + ts;
        String title = "Content category removed " + uniqueMarker;
        String createPayload = """
                {
                  "slug": "%s",
                  "title": "%s",
                  "body": "<p>test</p>",
                  "authorName": "Tác giả kiểm thử",
                  "publishStatus": "PUBLISHED",
                  "translations": { "en": { "title": "%s EN", "authorName": "Test Author" } }
                }
                """.formatted(slug, title, title);

        mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.authorName").value("Tác giả kiểm thử"))
                .andExpect(jsonPath("$.data.category").doesNotExist())
                .andExpect(jsonPath("$.data.categoryId").doesNotExist())
                .andExpect(jsonPath("$.data.categories").doesNotExist());

        mockMvc.perform(get("/api/v1/articles")
                        .param("q", uniqueMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(1))
                .andExpect(jsonPath("$.data[0].authorName").value("Tác giả kiểm thử"))
                .andExpect(jsonPath("$.data[0].category").doesNotExist())
                .andExpect(jsonPath("$.data[0].categories").doesNotExist());

        String noAuthorSlug = "article-without-author-" + ts;
        String noAuthorMarker = "NoAuthor" + ts;
        String noAuthorPayload = """
                {
                  "slug": "%s",
                  "title": "%s",
                  "body": "<p>test</p>",
                  "publishStatus": "PUBLISHED",
                  "translations": { "en": { "title": "%s EN" } }
                }
                """.formatted(noAuthorSlug, noAuthorMarker, noAuthorMarker);

        mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(noAuthorPayload))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/articles")
                        .param("q", noAuthorMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].authorName").doesNotExist());

        mockMvc.perform(get("/api/v1/content-categories"))
                .andExpect(status().isNotFound());
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
