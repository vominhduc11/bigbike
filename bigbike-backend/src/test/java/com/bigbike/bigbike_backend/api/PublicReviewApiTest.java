package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
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
 * Covers FULL-12 batch 3: public review submission — validation, honeypot, duplicate guard.
 * Endpoint: POST /api/v1/products/{productId}/reviews (PublicReviewController).
 * Uses prod_ls2_ff800 from test seed. No auth required (public endpoint).
 * MockMvc is built without springSecurity() — the CSRF filter targets cookie-session
 * flows and is not relevant for this public-POST business-logic coverage.
 * See Phase1NReviewsApiTest for the same pattern.
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class PublicReviewApiTest {

    private static final String PRODUCT_ID = "prod_ls2_ff800";
    private static final String REVIEWS_URL = "/api/v1/products/" + PRODUCT_ID + "/reviews";

    @Autowired WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        // No springSecurity() — skips the CSRF double-submit filter which would reject
        // cookie-less POST requests.  Business-logic validation (rating, length, duplicate)
        // is exercised correctly without the security wrapper.
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    // ── 1. Valid submit ───────────────────────────────────────────────────────

    @Test
    void submitReview_valid_returns201WithSuccessTrue() throws Exception {
        String author = "Author-" + UUID.randomUUID();
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"" + author + "\",\"rating\":5,\"comment\":\"San pham tot.\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));
    }

    // ── 2. Honeypot — stealth drop ────────────────────────────────────────────

    @Test
    void submitReview_honeypotFilled_returns201SilentlyWithoutPersist() throws Exception {
        // website field non-empty → accept-and-drop silently (bot cannot distinguish).
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"Bot\",\"rating\":5,"
                                + "\"website\":\"http://spam.example.com\","
                                + "\"comment\":\"Spam comment.\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));
    }

    // ── 3. Validation — authorName ────────────────────────────────────────────

    @Test
    void submitReview_missingAuthorName_returns400() throws Exception {
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":4,\"comment\":\"No name.\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitReview_authorNameTooLong_returns400() throws Exception {
        String longName = "A".repeat(81);
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"" + longName + "\",\"rating\":4,\"comment\":\"Good.\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── 4. Validation — rating ────────────────────────────────────────────────

    @Test
    void submitReview_ratingNull_returns400() throws Exception {
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"Tester\",\"comment\":\"No rating.\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitReview_ratingZero_returns400() throws Exception {
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"Tester\",\"rating\":0,\"comment\":\"Zero.\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void submitReview_ratingTooHigh_returns400() throws Exception {
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"Tester\",\"rating\":6,\"comment\":\"Too high.\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── 5. Validation — comment length ───────────────────────────────────────

    @Test
    void submitReview_commentTooLong_returns400() throws Exception {
        String longComment = "C".repeat(1001);
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"Tester\",\"rating\":4,\"comment\":\"" + longComment + "\"}"))
                .andExpect(status().isBadRequest());
    }

    // ── 6. Duplicate guard — 24-hour window ──────────────────────────────────

    @Test
    void submitReview_duplicate_within24h_returns409() throws Exception {
        // Unique author per test run to prevent interference with other review tests.
        String author = "DupAuthor-" + UUID.randomUUID();
        String body = "{\"authorName\":\"" + author + "\",\"rating\":3,"
                + "\"comment\":\"Duplicate guard test comment.\"}";

        // First submit → 201
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        // Identical submit within 24 h → 409 (duplicate guard: same productId + author + comment)
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());
    }
}
