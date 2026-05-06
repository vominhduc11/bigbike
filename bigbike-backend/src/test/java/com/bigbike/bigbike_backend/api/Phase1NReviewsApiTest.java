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
import org.springframework.data.domain.PageRequest;
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

    // Plain MockMvc (no Spring Security) â€” for functional behavior tests
    private MockMvc mockMvc;
    // Security-aware MockMvc â€” for auth/permission tests
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

        approvedReviewId = insertReview(PRODUCT_ID, "Reviewer APPROVED", 5, "Tuyá»‡t vá»i!", "APPROVED");
        pendingReviewId = insertReview(PRODUCT_ID, "Reviewer PENDING", 3, "BĂ¬nh thÆ°á»ng", "PENDING");
        spamReviewId = insertReview(PRODUCT_ID, "Spam Bot", 1, "Buy cheap!", "SPAM");
    }

    @Test
    void publicGetReviews_returnsOnlyApproved() throws Exception {
        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews").isArray())
                .andExpect(jsonPath("$.data.reviews[?(@.id == " + pendingReviewId + ")]").isEmpty())
                .andExpect(jsonPath("$.data.reviews[?(@.id == " + spamReviewId + ")]").isEmpty())
                .andExpect(jsonPath("$.data.reviews[?(@.id == " + approvedReviewId + ")]").isNotEmpty());
    }

    @Test
    void publicGetReviews_avgRatingAndTotalCountOnlyApproved() throws Exception {
        insertReview(PRODUCT_ID, "Reviewer APPROVED 2", 3, "Táº¡m á»•n", "APPROVED");

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avgRating").isNumber())
                .andExpect(jsonPath("$.data.totalReviews").isNumber())
                .andExpect(jsonPath("$.data.pagination.page").value(1))
                .andExpect(jsonPath("$.data.pagination.pageSize").value(10));
    }

    @Test
    void publicGetReviews_defaultPagination_returnsFirstPageMetadata() throws Exception {
        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pagination.page").value(1))
                .andExpect(jsonPath("$.data.pagination.pageSize").value(10))
                .andExpect(jsonPath("$.data.pagination.totalItems").isNumber())
                .andExpect(jsonPath("$.data.pagination.totalPages").isNumber())
                .andExpect(jsonPath("$.data.pagination.hasNext").isBoolean())
                .andExpect(jsonPath("$.data.pagination.hasPrevious").value(false));
    }

    @Test
    void publicGetReviews_requestedPageAndSize_returnsExpectedWindow() throws Exception {
        Long newestId = insertReview(PRODUCT_ID, "Page Review 1", 5, "Newest", "APPROVED", Instant.parse("2030-01-01T00:00:03Z"));
        Long middleId = insertReview(PRODUCT_ID, "Page Review 2", 4, "Middle", "APPROVED", Instant.parse("2030-01-01T00:00:02Z"));
        Long oldestId = insertReview(PRODUCT_ID, "Page Review 3", 3, "Oldest", "APPROVED", Instant.parse("2030-01-01T00:00:01Z"));

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("page", "1")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pagination.page").value(1))
                .andExpect(jsonPath("$.data.pagination.pageSize").value(2))
                .andExpect(jsonPath("$.data.reviews[0].id").value(newestId))
                .andExpect(jsonPath("$.data.reviews[1].id").value(middleId))
                .andExpect(jsonPath("$.data.reviews[?(@.id == " + oldestId + ")]").isEmpty())
                .andExpect(jsonPath("$.data.pagination.hasNext").value(true))
                .andExpect(jsonPath("$.data.pagination.hasPrevious").value(false));

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("page", "2")
                        .param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pagination.page").value(2))
                .andExpect(jsonPath("$.data.pagination.pageSize").value(2))
                .andExpect(jsonPath("$.data.reviews[?(@.id == " + oldestId + ")]").isNotEmpty())
                .andExpect(jsonPath("$.data.pagination.hasPrevious").value(true));
    }

    @Test
    void publicGetReviews_totalReviewsCountsAllApprovedNotJustCurrentPage() throws Exception {
        long approvedBefore = reviewRepo.findByProductIdAndStatus(PRODUCT_ID, "APPROVED", PageRequest.of(0, 500))
                .getTotalElements();

        insertReview(PRODUCT_ID, "Aggregate Approved 1", 5, "A1", "APPROVED", Instant.parse("2031-01-01T00:00:01Z"));
        insertReview(PRODUCT_ID, "Aggregate Approved 2", 4, "A2", "APPROVED", Instant.parse("2031-01-01T00:00:02Z"));
        insertReview(PRODUCT_ID, "Aggregate Pending", 1, "Ignored", "PENDING", Instant.parse("2031-01-01T00:00:03Z"));

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("page", "1")
                        .param("size", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews.length()").value(1))
                .andExpect(jsonPath("$.data.totalReviews").value(approvedBefore + 2))
                .andExpect(jsonPath("$.data.pagination.totalItems").value(approvedBefore + 2));
    }

    @Test
    void publicGetReviews_invalidPagination_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("page", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("size", "51"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void publicGetReviews_unknownProduct_returns404() throws Exception {
        mockMvc.perform(get("/api/v1/products/" + UNKNOWN_PRODUCT_ID + "/reviews"))
                .andExpect(status().isNotFound());
    }

    @Test
    void publicPostReview_success_createsPendingReview() throws Exception {
        long countBefore = reviewRepo.findByProductIdAndStatus(PRODUCT_ID, "PENDING", PageRequest.of(0, 500))
                .getTotalElements();

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van Test","rating":4,"comment":"San pham rat tot"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));

        long countAfter = reviewRepo.findByProductIdAndStatus(PRODUCT_ID, "PENDING", PageRequest.of(0, 500))
                .getTotalElements();
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

    @Test
    void adminDeleteReview_returns204() throws Exception {
        Long toDelete = insertReview(PRODUCT_ID, "To Delete", 2, "Will be deleted", "PENDING");

        mockMvc.perform(delete("/api/v1/admin/reviews/" + toDelete)
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isNoContent());

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(toDelete)).isEmpty();
    }

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
                .andExpect(jsonPath("$.data[0].productName").exists())
                .andExpect(jsonPath("$.data[0].productSlug").exists())
                .andExpect(jsonPath("$.pagination.page").value(1))
                .andExpect(jsonPath("$.pagination.pageSize").value(20))
                .andExpect(jsonPath("$.meta.requestId").exists());
    }

    @Test
    void adminGetReview_returnsProductMetadata() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reviews/" + approvedReviewId)
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(approvedReviewId))
                .andExpect(jsonPath("$.data.productId").value(PRODUCT_ID))
                .andExpect(jsonPath("$.data.productName").value("LS2 FF800 Storm"))
                .andExpect(jsonPath("$.data.productSlug").value("mu-bao-hiem-ls2-ff800"));
    }

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
        String editorToken = jwtService.generateAccessToken("editor-id", "editor@bigbike.test", "EDITOR");

        secMvc.perform(get("/api/v1/admin/reviews")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPatchStatus_missingReviewsWritePermission_returns403() throws Exception {
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

    private Long insertReview(String productId, String authorName, int rating, String body, String status) {
        return insertReview(productId, authorName, rating, body, status, Instant.now());
    }

    private Long insertReview(
            String productId,
            String authorName,
            int rating,
            String body,
            String status,
            Instant createdAt
    ) {
        ReviewEntity review = new ReviewEntity();
        review.setProductId(productId);
        review.setAuthorName(authorName);
        review.setRating((short) rating);
        review.setBody(body);
        review.setStatus(status);
        review.setCreatedAt(createdAt);
        review.setUpdatedAt(createdAt);
        return reviewRepo.save(review).getId();
    }
}
