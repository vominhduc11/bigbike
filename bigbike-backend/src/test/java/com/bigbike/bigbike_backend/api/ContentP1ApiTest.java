package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.assertj.core.api.Assertions.assertThat;
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

    @Autowired
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private final com.fasterxml.jackson.databind.ObjectMapper json = new com.fasterxml.jackson.databind.ObjectMapper();

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void recoversLegacyArticleOnReadWithoutWritingAndKeepsOriginalBlocksWhenAddingContent() throws Exception {
        String slug = "article-recovery-" + java.util.UUID.randomUUID();
        var payload = json.createObjectNode();
        payload.put("slug", slug).put("title", "Bài kiểm tra khôi phục")
                .put("publishStatus", "DRAFT")
                .put("body", "<p>Nội dung gốc <a href=\"/tin-tuc/\">Tin tức</a></p>"
                        + "<table><tr><th>Cỡ</th><td>M</td></tr></table>");
        payload.putObject("translations").putObject("en")
                .put("title", "Article recovery test").put("body", "<p>Keep English</p>");
        String created = mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content(json.writeValueAsBytes(payload)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String id = json.readTree(created).path("data").path("id").asText();
        jdbc.update("UPDATE articles SET body_blocks=NULL WHERE id=?", id);
        var before = jdbc.queryForMap("SELECT body,body_en,updated_at FROM articles WHERE id=?", id);

        String detail = mockMvc.perform(get("/api/v1/admin/content/article/{id}", id)
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bodyBlocks[0].type").value("paragraph"))
                .andExpect(jsonPath("$.data.bodyBlocks[1].type").value("table"))
                .andReturn().getResponse().getContentAsString();
        assertThat(jdbc.queryForObject("SELECT body_blocks FROM articles WHERE id=?", String.class, id)).isNull();
        assertThat(jdbc.queryForMap("SELECT body,body_en,updated_at FROM articles WHERE id=?", id)).isEqualTo(before);

        var blocks = (com.fasterxml.jackson.databind.node.ArrayNode) json.readTree(detail).path("data").path("bodyBlocks");
        blocks.addObject().put("type", "paragraph").put("html", "<p>Phần bổ sung</p>");
        var update = json.createObjectNode().set("bodyBlocks", blocks);
        mockMvc.perform(patch("/api/v1/admin/content/articles/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content(json.writeValueAsBytes(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bodyBlocks.length()").value(3));
        String body = jdbc.queryForObject("SELECT body FROM articles WHERE id=?", String.class, id);
        assertThat(body).contains("Nội dung gốc", "<table>", "href=\"/tin-tuc/\"", "Phần bổ sung");
        assertThat(jdbc.queryForObject("SELECT body_en FROM articles WHERE id=?", String.class, id))
                .isEqualTo(before.get("body_en"));

        mockMvc.perform(patch("/api/v1/admin/content/articles/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("{\"body\":\"<p>New HTML import</p>\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.bodyBlocks.length()").value(1))
                .andExpect(jsonPath("$.data.bodyBlocks[0].html").value("<p>New HTML import</p>"));
    }

    @Test
    void savesAndUpdatesTheManualFeaturedArticleFlag() throws Exception {
        String suffix = String.valueOf(System.nanoTime());
        String slug = "manual-featured-" + suffix;
        String response = mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("""
                                {
                                  "slug": "%s",
                                  "title": "Manual featured %s",
                                  "body": "<p>Body</p>",
                                  "publishStatus": "PUBLISHED",
                                  "featured": true,
                                  "translations": { "en": { "title": "Manual featured %s" } }
                                }
                                """.formatted(slug, suffix, suffix)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.featured").value(true))
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(response).path("data").path("id").asText();

        mockMvc.perform(patch("/api/v1/admin/content/articles/{id}", id)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-Admin-Permissions", "content.update")
                        .content("{\"featured\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.featured").value(false));
    }

    @Test
    void articleApiDoesNotExposeContentCategoryFieldsOrEndpoint() throws Exception {
        long ts = System.currentTimeMillis();
        String slug = "article-retired-fields-" + ts;
        String titleMarker = "Article retired fields " + ts;
        String bodyMarker = "BodyOnlyRetiredFields" + ts;
        String createPayload = """
                {
                  "slug": "%s",
                  "title": "%s",
                  "body": "<p>%s</p>",
                  "excerpt": "Trường cũ không được lưu",
                  "authorName": "Tên tác giả cũ không được lưu",
                  "publishStatus": "PUBLISHED",
                  "translations": { "en": { "title": "%s EN", "excerpt": "Old EN excerpt", "authorName": "Old EN author" } }
                }
                """.formatted(slug, titleMarker, bodyMarker, titleMarker);

        String createdResponse = mockMvc.perform(post("/api/v1/admin/content/articles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .characterEncoding(StandardCharsets.UTF_8)
                        .header("X-Admin-Permissions", "content.update")
                        .content(createPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.slug").value(slug))
                .andExpect(jsonPath("$.data.excerpt").doesNotExist())
                .andExpect(jsonPath("$.data.authorName").doesNotExist())
                .andExpect(jsonPath("$.data.category").doesNotExist())
                .andExpect(jsonPath("$.data.categoryId").doesNotExist())
                .andExpect(jsonPath("$.data.categories").doesNotExist())
                .andReturn()
                .getResponse()
                .getContentAsString();
        String articleId = json.readTree(createdResponse).path("data").path("id").asText();

        mockMvc.perform(get("/api/v1/articles")
                        .param("q", titleMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(1))
                .andExpect(jsonPath("$.data[0].excerpt").doesNotExist())
                .andExpect(jsonPath("$.data[0].authorName").doesNotExist())
                .andExpect(jsonPath("$.data[0].category").doesNotExist())
                .andExpect(jsonPath("$.data[0].categories").doesNotExist());

        mockMvc.perform(get("/api/v1/articles")
                        .param("q", bodyMarker))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pagination.totalItems").value(0));

        mockMvc.perform(get("/api/v1/admin/content/article/{id}", articleId)
                        .header("X-Admin-Permissions", "content.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.translations.en.excerpt").doesNotExist())
                .andExpect(jsonPath("$.data.translations.en.authorName").doesNotExist());

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
    void articleVideoBlockAcceptsApprovedFullSourcesOnly() throws Exception {
        long ts = System.currentTimeMillis();

        for (String[] source : new String[][] {
                { "youtube", "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
                { "tiktok", "https://www.tiktok.com/@bigbike/video/7251234567890123456" },
                { "facebook", "https://www.facebook.com/BigBike/videos/1234567890" },
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

        for (String[] invalid : new String[][] {
                { "youtube", "https://youtu.be/dQw4w9WgXcQ" },
                { "tiktok", "https://vt.tiktok.com/ZSabcDEF/" },
                { "facebook", "https://fb.watch/abcdEF123/" }
        }) {
            String payload = """
                    {
                      "slug": "article-video-invalid-%s-%s",
                      "title": "Video invalid %s",
                      "publishStatus": "DRAFT",
                      "translations": { "en": { "title": "Invalid video %s" } },
                      "bodyBlocks": [
                        { "type": "video", "provider": "%s", "url": "%s" }
                      ]
                    }
                    """.formatted(invalid[0], ts, invalid[0], invalid[0], invalid[0], invalid[1]);

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
