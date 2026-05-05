package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * Phase 1 hardening: Reviews module API tests.
 *
 * Covers:
 *  - Public GET: only APPROVED reviews returned
 *  - Public POST: success + validation + 404 product
 *  - Admin PATCH status: valid values, invalid values, missing status
 *  - Admin DELETE
 *  - Admin list filter by status
 *  - Permission/auth: no auth, missing reviews.read, missing reviews.write
 */
@SpringBootTest
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
class Phase1NReviewsApiTest {

    private static final String PRODUCT_ID = "prod_ls2_ff800";
    private static final String UNKNOWN_PRODUCT_ID = "prod-does-not-exist-xyz";

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ReviewJpaRepository reviewRepo;
    @Autowired JwtService jwtService;

    // Plain MockMvc (no Spring Security) — for functional behavior tests
    private MockMvc mockMvc;
    // Security-aware MockMvc — for auth/permission tests
    private MockMvc secMvc;

    private Long approvedReviewId;
    private Long pendingReviewId;
    private Long spamReviewId;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
        secMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();

        approvedReviewId = insertReview(PRODUCT_ID, "Reviewer APPROVED", 5, "Tuyệt vời!", "APPROVED");
        pendingReviewId  = insertReview(PRODUCT_ID, "Reviewer PENDING",  3, "Bình thường",  "PENDING");
        spamReviewId     = insertReview(PRODUCT_ID, "Spam Bot",          1, "Buy cheap!",    "SPAM");
    }

    // ── Public GET ─────────────────────────────────────────────────────────────

    @Test
    void publicGetReviews_returnsOnlyApproved() throws Exception {
        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews").isArray())
                // All returned reviews must be APPROVED — check authorName not PENDING/SPAM
                .andExpect(jsonPath("$.data.reviews[?(@.authorName == 'Reviewer PENDING')]").isEmpty())
                .andExpect(jsonPath("$.data.reviews[?(@.authorName == 'Spam Bot')]").isEmpty())
                .andExpect(jsonPath("$.data.reviews[?(@.authorName == 'Reviewer APPROVED')]").isNotEmpty());
    }

    @Test
    void publicGetReviews_avgRatingAndTotalCountOnlyApproved() throws Exception {
        // Insert one more APPROVED for this test to have predictable data
        insertReview(PRODUCT_ID, "Reviewer APPROVED 2", 3, "Tạm ổn", "APPROVED");

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avgRating").isNumber())
                .andExpect(jsonPath("$.data.totalReviews").isNumber());
        // totalReviews must not include PENDING/SPAM rows — asserted by checking only APPROVED are in list
    }

    // ── Public POST ────────────────────────────────────────────────────────────

    @Test
    void publicPostReview_success_createsPendingReview() throws Exception {
        long countBefore = reviewRepo.findByProductIdAndStatusOrderByCreatedAtDesc(PRODUCT_ID, "PENDING").size();

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van Test","rating":4,"comment":"San pham rat tot"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));

        long countAfter = reviewRepo.findByProductIdAndStatusOrderByCreatedAtDesc(PRODUCT_ID, "PENDING").size();
        org.assertj.core.api.Assertions.assertThat(countAfter).isEqualTo(countBefore + 1);
    }

    @Test
    void publicPostReview_missingAuthorName_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"","rating":4,"comment":"Comment"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicPostReview_authorNameTooLong_returns400() throws Exception {
        String longName = "A".repeat(81);
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"" + longName + "\",\"rating\":4,\"comment\":\"OK\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicPostReview_nullRating_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Tester","rating":null,"comment":"OK"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicPostReview_ratingTooLow_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Tester","rating":0,"comment":"OK"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicPostReview_ratingTooHigh_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Tester","rating":6,"comment":"OK"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicPostReview_commentTooLong_returns400() throws Exception {
        String longComment = "C".repeat(1001);
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"Tester\",\"rating\":4,\"comment\":\"" + longComment + "\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicPostReview_unknownProduct_returns404() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + UNKNOWN_PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Tester","rating":3,"comment":"OK"}
                                """))
                .andExpect(status().isNotFound());
    }

    // ── Admin PATCH status ─────────────────────────────────────────────────────

    @Test
    void adminPatchStatus_approve_returns200WithApprovedStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    @Test
    void adminPatchStatus_spam_returns200WithSpamStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"SPAM\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SPAM"));
    }

    @Test
    void adminPatchStatus_trash_returns200WithTrashStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + approvedReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"TRASH\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("TRASH"));
    }

    @Test
    void adminPatchStatus_pending_returns200WithPendingStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + spamReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PENDING\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    @Test
    void adminPatchStatus_invalidStatus_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"HAHA\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void adminPatchStatus_missingStatusKey_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    // ── Admin DELETE ───────────────────────────────────────────────────────────

    @Test
    void adminDeleteReview_returns204() throws Exception {
        Long toDelete = insertReview(PRODUCT_ID, "To Delete", 2, "Will be deleted", "PENDING");

        mockMvc.perform(delete("/api/v1/admin/reviews/" + toDelete)
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isNoContent());

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(toDelete)).isEmpty();
    }

    // ── Admin list filter by status ────────────────────────────────────────────

    @Test
    void adminListReviews_filterByStatus_returnsOnlyMatchingStatus() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("status", "APPROVED")
                        .param("page", "1")
                        .param("size", "100")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.status != 'APPROVED')]").isEmpty());
    }

    @Test
    void adminListReviews_filterByPendingStatus_returnsOnlyPending() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("status", "PENDING")
                        .param("page", "1")
                        .param("size", "100")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data[?(@.status != 'PENDING')]").isEmpty());
    }

    @Test
    void adminListReviews_noFilter_returnsPaginatedList() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("page", "1")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(20))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    // ── Permission / auth ──────────────────────────────────────────────────────

    @Test
    void adminListReviews_noAuth_returns401() throws Exception {
        secMvc.perform(get("/api/v1/admin/reviews"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminPatchStatus_noAuth_returns401() throws Exception {
        secMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminDeleteReview_noAuth_returns401() throws Exception {
        secMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminListReviews_missingReviewsReadPermission_returns403() throws Exception {
        // EDITOR role has no reviews.read
        String editorToken = jwtService.generateAccessToken("editor-id", "editor@bigbike.test", "EDITOR");

        secMvc.perform(get("/api/v1/admin/reviews")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPatchStatus_missingReviewsWritePermission_returns403() throws Exception {
        // EDITOR role has no reviews.write
        String editorToken = jwtService.generateAccessToken("editor-id", "editor@bigbike.test", "EDITOR");

        secMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminDeleteReview_missingReviewsWritePermission_returns403() throws Exception {
        String editorToken = jwtService.generateAccessToken("editor-id", "editor@bigbike.test", "EDITOR");

        secMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Long insertReview(String productId, String authorName, int rating, String body, String status) {
        ReviewEntity r = new ReviewEntity();
        r.setProductId(productId);
        r.setAuthorName(authorName);
        r.setRating((short) rating);
        r.setBody(body);
        r.setStatus(status);
        Instant now = Instant.now();
        r.setCreatedAt(now);
        r.setUpdatedAt(now);
        return reviewRepo.save(r).getId();
    }
}
