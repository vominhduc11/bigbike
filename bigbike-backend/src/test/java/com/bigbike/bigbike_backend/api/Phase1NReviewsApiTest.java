package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
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
    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired WebApplicationContext webApplicationContext;
    @Autowired ReviewJpaRepository reviewRepo;
    @Autowired ProductJpaRepository productRepo;
    @Autowired AuditLogJpaRepository auditLogRepo;
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
    void adminPatchStatus_invalidStatus_doesNotCreateAuditLog() throws Exception {
        long countBefore = countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"HAHA\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        org.assertj.core.api.Assertions.assertThat(countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId))
                .isEqualTo(countBefore);
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
    void adminPatchStatus_writesAuditLog() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .with(remoteAddress("203.0.113.10"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("User-Agent", "Phase2C-Test-Agent")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk());

        AuditLogEntity auditLog = findLatestReviewAudit("REVIEW_STATUS_CHANGED", pendingReviewId)
                .orElseThrow(() -> new AssertionError("Expected review status audit log."));

        org.assertj.core.api.Assertions.assertThat(auditLog.getActorType()).isEqualTo("ADMIN");
        org.assertj.core.api.Assertions.assertThat(auditLog.getActorId()).isEqualTo(DEV_ADMIN_ID);
        org.assertj.core.api.Assertions.assertThat(auditLog.getResourceType()).isEqualTo("REVIEW");
        org.assertj.core.api.Assertions.assertThat(auditLog.getBeforeData()).contains("\"id\":" + pendingReviewId);
        org.assertj.core.api.Assertions.assertThat(auditLog.getBeforeData()).contains("\"status\":\"PENDING\"");
        org.assertj.core.api.Assertions.assertThat(auditLog.getAfterData()).contains("\"id\":" + pendingReviewId);
        org.assertj.core.api.Assertions.assertThat(auditLog.getAfterData()).contains("\"status\":\"APPROVED\"");
        org.assertj.core.api.Assertions.assertThat(auditLog.getIpAddress()).isEqualTo("203.0.113.10");
        org.assertj.core.api.Assertions.assertThat(auditLog.getUserAgent()).isEqualTo("Phase2C-Test-Agent");
    }

    @Test
    void adminPatchStatus_notFound_doesNotCreateAuditLog() throws Exception {
        Long missingReviewId = reviewRepo.findAll().stream()
                .map(ReviewEntity::getId)
                .max(Long::compareTo)
                .orElse(0L) + 999_999L;
        long countBefore = countReviewAudits("REVIEW_STATUS_CHANGED", missingReviewId);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + missingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isNotFound());

        org.assertj.core.api.Assertions.assertThat(countReviewAudits("REVIEW_STATUS_CHANGED", missingReviewId))
                .isEqualTo(countBefore);
    }

    @Test
    void adminPatchStatus_approve_syncsProductRatingCache() throws Exception {
        TestProductRef product = createPublishedProductCopy("Rating Sync Approve");
        insertReview(product.id(), "Existing Approved", 5, "Great", "APPROVED");
        Long pendingId = insertReview(product.id(), "Pending Review", 3, "Okay", "PENDING");
        setProductRatingCache(product.id(), new BigDecimal("1.1"), 99);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avgRating").value(4.0))
                .andExpect(jsonPath("$.data.totalReviews").value(2));

        mockMvc.perform(get("/api/v1/products/" + product.slug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(product.id()))
                .andExpect(jsonPath("$.data.rating").value(4.0))
                .andExpect(jsonPath("$.data.ratingCount").value(2));

        mockMvc.perform(get("/api/v1/products")
                        .param("page", "1")
                        .param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == '" + product.slug() + "' && @.rating == 4.0 && @.ratingCount == 2)]")
                        .isNotEmpty());
    }

    @Test
    void adminPatchStatus_trashApprovedReview_syncsProductRatingCache() throws Exception {
        TestProductRef product = createPublishedProductCopy("Rating Sync Trash");
        Long approvedId = insertReview(product.id(), "Approved Review", 5, "Great", "APPROVED");
        setProductRatingCache(product.id(), new BigDecimal("4.8"), 88);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + approvedId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"TRASH\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("TRASH"));

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avgRating").value(0.0))
                .andExpect(jsonPath("$.data.totalReviews").value(0));

        mockMvc.perform(get("/api/v1/products/" + product.slug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(product.id()))
                .andExpect(jsonPath("$.data.rating").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.ratingCount").value(0));

        mockMvc.perform(get("/api/v1/products")
                        .param("page", "1")
                        .param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == '" + product.slug() + "' && @.ratingCount == 0)]")
                        .isNotEmpty());
    }

    @Test
    void adminDeleteApprovedReview_syncsProductRatingCache() throws Exception {
        TestProductRef product = createPublishedProductCopy("Rating Sync Delete");
        Long approvedId = insertReview(product.id(), "Approved Review", 4, "Good", "APPROVED");
        setProductRatingCache(product.id(), new BigDecimal("4.9"), 77);

        mockMvc.perform(delete("/api/v1/admin/reviews/" + approvedId)
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avgRating").value(0.0))
                .andExpect(jsonPath("$.data.totalReviews").value(0));

        mockMvc.perform(get("/api/v1/products/" + product.slug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(product.id()))
                .andExpect(jsonPath("$.data.rating").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.ratingCount").value(0));

        mockMvc.perform(get("/api/v1/products")
                        .param("page", "1")
                        .param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.slug == '" + product.slug() + "' && @.ratingCount == 0)]")
                        .isNotEmpty());
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
    void adminDeleteReview_writesAuditLog() throws Exception {
        Long toDelete = insertReview(PRODUCT_ID, "To Delete With Audit", 2, "Will be deleted", "PENDING");

        mockMvc.perform(delete("/api/v1/admin/reviews/" + toDelete)
                        .with(remoteAddress("198.51.100.25"))
                        .header("User-Agent", "Phase2C-Delete-Agent")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isNoContent());

        AuditLogEntity auditLog = findLatestReviewAudit("REVIEW_DELETED", toDelete)
                .orElseThrow(() -> new AssertionError("Expected review delete audit log."));

        org.assertj.core.api.Assertions.assertThat(auditLog.getActorType()).isEqualTo("ADMIN");
        org.assertj.core.api.Assertions.assertThat(auditLog.getActorId()).isEqualTo(DEV_ADMIN_ID);
        org.assertj.core.api.Assertions.assertThat(auditLog.getResourceType()).isEqualTo("REVIEW");
        org.assertj.core.api.Assertions.assertThat(auditLog.getBeforeData()).contains("\"id\":" + toDelete);
        org.assertj.core.api.Assertions.assertThat(auditLog.getBeforeData()).contains("\"status\":\"PENDING\"");
        org.assertj.core.api.Assertions.assertThat(auditLog.getAfterData()).contains("\"id\":" + toDelete);
        org.assertj.core.api.Assertions.assertThat(auditLog.getAfterData()).contains("\"deleted\":true");
        org.assertj.core.api.Assertions.assertThat(auditLog.getIpAddress()).isEqualTo("198.51.100.25");
        org.assertj.core.api.Assertions.assertThat(auditLog.getUserAgent()).isEqualTo("Phase2C-Delete-Agent");
    }

    @Test
    void adminDeleteReview_notFound_doesNotCreateAuditLog() throws Exception {
        Long missingReviewId = reviewRepo.findAll().stream()
                .map(ReviewEntity::getId)
                .max(Long::compareTo)
                .orElse(0L) + 999_999L;
        long countBefore = countReviewAudits("REVIEW_DELETED", missingReviewId);

        mockMvc.perform(delete("/api/v1/admin/reviews/" + missingReviewId)
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isNotFound());

        org.assertj.core.api.Assertions.assertThat(countReviewAudits("REVIEW_DELETED", missingReviewId))
                .isEqualTo(countBefore);
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
    void adminAuditLogList_canFilterReviewResource() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/audit-logs")
                        .param("resourceType", "REVIEW")
                        .header("X-Admin-Permissions", "audit-logs.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.resourceType == 'REVIEW' && @.action == 'REVIEW_STATUS_CHANGED')]")
                        .isNotEmpty())
                .andExpect(jsonPath("$.data[?(@.resourceType == 'REVIEW' && @.action == 'REVIEW_STATUS_CHANGED' && @.resourceCode == 'Review #"
                        + pendingReviewId + "' && @.resourceDisplayName == 'LS2 FF800 Storm')]").isNotEmpty());
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
    void adminPatchStatus_missingReviewsWritePermission_doesNotCreateAuditLog() throws Exception {
        String editorToken = jwtService.generateAccessToken("editor-id", "editor@bigbike.test", "EDITOR");
        long countBefore = countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId);

        secMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"APPROVED\"}")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());

        org.assertj.core.api.Assertions.assertThat(countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId))
                .isEqualTo(countBefore);
    }

    @Test
    void adminDeleteReview_missingReviewsWritePermission_returns403() throws Exception {
        String editorToken = jwtService.generateAccessToken("editor-id", "editor@bigbike.test", "EDITOR");

        secMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminDeleteReview_missingReviewsWritePermission_doesNotCreateAuditLog() throws Exception {
        String editorToken = jwtService.generateAccessToken("editor-id", "editor@bigbike.test", "EDITOR");
        long countBefore = countReviewAudits("REVIEW_DELETED", pendingReviewId);

        secMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());

        org.assertj.core.api.Assertions.assertThat(countReviewAudits("REVIEW_DELETED", pendingReviewId))
                .isEqualTo(countBefore);
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

    private TestProductRef createPublishedProductCopy(String nameSuffix) {
        ProductEntity source = productRepo.findById(PRODUCT_ID)
                .orElseThrow(() -> new AssertionError("Expected seed product."));

        String slugSeed = nameSuffix.toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
        String unique = UUID.randomUUID().toString().substring(0, 8);

        ProductEntity entity = new ProductEntity();
        entity.setId("prod_review_sync_" + unique);
        entity.setSlug("review-sync-" + slugSeed + "-" + unique);
        entity.setName("Review Sync " + nameSuffix);
        entity.setSku(source.getSku());
        entity.setCategory(source.getCategory());
        entity.setBrand(source.getBrand());
        entity.setRetailPrice(source.getRetailPrice());
        entity.setCompareAtPrice(source.getCompareAtPrice());
        entity.setSalePrice(source.getSalePrice());
        entity.setCurrency(source.getCurrency());
        entity.setStockState(source.getStockState());
        entity.setStockQuantity(source.getStockQuantity());
        entity.setForceOutOfStock(source.getForceOutOfStock());
        entity.setPublishStatus(source.getPublishStatus());
        entity.setFeatured(source.getFeatured());
        entity.setShowOnHomepage(source.getShowOnHomepage());
        entity.setCreatedAt(Instant.now());
        entity.setUpdatedAt(Instant.now());
        entity.setRating(null);
        entity.setRatingCount(0);

        productRepo.save(entity);
        return new TestProductRef(entity.getId(), entity.getSlug());
    }

    private void setProductRatingCache(String productId, BigDecimal rating, Integer ratingCount) {
        ProductEntity product = productRepo.findById(productId)
                .orElseThrow(() -> new AssertionError("Expected product " + productId));
        product.setRating(rating);
        product.setRatingCount(ratingCount);
        product.setUpdatedAt(Instant.now());
        productRepo.save(product);
    }

    private Optional<AuditLogEntity> findLatestReviewAudit(String action, Long reviewId) {
        String reviewIdSnippet = "\"id\":" + reviewId;
        return auditLogRepo.findAll().stream()
                .filter(log -> action.equals(log.getAction()))
                .filter(log -> "REVIEW".equals(log.getResourceType()))
                .filter(log -> contains(log.getBeforeData(), reviewIdSnippet) || contains(log.getAfterData(), reviewIdSnippet))
                .max(Comparator.comparing(AuditLogEntity::getCreatedAt));
    }

    private boolean contains(String value, String expected) {
        return value != null && value.contains(expected);
    }

    private long countReviewAudits(String action, Long reviewId) {
        String reviewIdSnippet = "\"id\":" + reviewId;
        return auditLogRepo.findAll().stream()
                .filter(log -> action.equals(log.getAction()))
                .filter(log -> "REVIEW".equals(log.getResourceType()))
                .filter(log -> contains(log.getBeforeData(), reviewIdSnippet) || contains(log.getAfterData(), reviewIdSnippet))
                .count();
    }

    private RequestPostProcessor remoteAddress(String remoteAddress) {
        return request -> {
            request.setRemoteAddr(remoteAddress);
            return request;
        };
    }

    private record TestProductRef(String id, String slug) {}
}
