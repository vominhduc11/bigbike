package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * API-level coverage for {@code GET /api/v1/search-suggest}. The endpoint had no test at all —
 * {@code TRACEABILITY_MATRIX.md} recorded it as "indirect via clients; no dedicated suite".
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class PublicSearchApiTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @BeforeEach
    void setup() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shouldReturnTheDocumentedPayloadShape() throws Exception {
        mockMvc.perform(get("/api/v1/search-suggest").param("q", "LS2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.query").value("LS2"))
                .andExpect(jsonPath("$.data.products").isArray())
                .andExpect(jsonPath("$.data.articles").isArray())
                .andExpect(jsonPath("$.data.products.length()").value(greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void shouldKeepNarrowingWhileTheCustomerIsStillTyping() throws Exception {
        // SEARCH_RULE_002: "l" → "ls" → "ls2" must never collapse to empty mid-typing. Before the
        // 2026-09-07 fix a partial word returned nothing at all.
        for (String typed : new String[] {"l", "ls", "ls2"}) {
            mockMvc.perform(get("/api/v1/search-suggest").param("q", typed))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.products.length()").value(greaterThanOrEqualTo(1)));
        }
    }

    @Test
    void shouldReturnEmptyPayloadForBlankQueryWithoutFailing() throws Exception {
        mockMvc.perform(get("/api/v1/search-suggest").param("q", "   "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.products.length()").value(0))
                .andExpect(jsonPath("$.data.articles.length()").value(0));
    }

    // Query-param constraint violations surface as 400 (the 422 in AGENTS.md §7.4 covers
    // @RequestBody DTO validation). Verified against the running backend, not assumed.
    @Test
    void shouldRejectAnOversizedQueryAndAnOutOfRangeLimit() throws Exception {
        mockMvc.perform(get("/api/v1/search-suggest").param("q", "x".repeat(101)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
        mockMvc.perform(get("/api/v1/search-suggest").param("q", "LS2").param("limit", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void shouldRejectAnUnsupportedLanguage() throws Exception {
        mockMvc.perform(get("/api/v1/search-suggest").param("q", "LS2").param("lang", "fr"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }
}
