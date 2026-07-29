package com.bigbike.bigbike_backend.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.auth.AdminUserEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.auth.AdminUserJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.auth.JwtService;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
import com.bigbike.bigbike_backend.service.public_.ReviewPhotoStorageService;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
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
    @Autowired AdminUserJpaRepository adminUserRepo;
    @MockitoBean EmailDispatchService emailDispatchService;
    @MockitoBean ReviewPhotoStorageService reviewPhotoStorageService;

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
        pendingReviewId = insertReview(PRODUCT_ID, "Reviewer PENDING", 3, "Bình thường", "PENDING");
        spamReviewId = insertReview(PRODUCT_ID, "Spam Bot", 1, "Buy cheap!", "SPAM");
        org.mockito.Mockito.clearInvocations(emailDispatchService);
        org.mockito.Mockito.clearInvocations(reviewPhotoStorageService);
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
        insertReview(PRODUCT_ID, "Reviewer APPROVED 2", 3, "Tạm ổn", "APPROVED");

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
    void publicGetReviews_filterByRating_returnsOnlyThatStar_summaryStaysGlobal() throws Exception {
        TestProductRef product = createPublishedProductCopy("Filter By Star");
        insertReview(product.id(), "Five A", 5, "5a", "APPROVED");
        insertReview(product.id(), "Five B", 5, "5b", "APPROVED");
        insertReview(product.id(), "Four A", 4, "4a", "APPROVED");
        insertReview(product.id(), "Three Pending", 3, "ignored", "PENDING");

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews")
                        .param("rating", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews.length()").value(2))
                .andExpect(jsonPath("$.data.reviews[?(@.rating != 5)]").isEmpty())
                // Summary panel ignores the list filter: 3 approved (two 5★ + one 4★).
                .andExpect(jsonPath("$.data.totalReviews").value(3))
                // Pagination follows the filtered list so "load more" pages within the bucket.
                .andExpect(jsonPath("$.data.pagination.totalItems").value(2));
    }

    @Test
    void publicGetReviews_sortHighest_ordersByRatingDesc() throws Exception {
        TestProductRef product = createPublishedProductCopy("Sort Highest");
        insertReview(product.id(), "Low", 2, "low", "APPROVED", Instant.parse("2030-02-01T00:00:01Z"));
        insertReview(product.id(), "High", 5, "high", "APPROVED", Instant.parse("2030-02-01T00:00:02Z"));
        insertReview(product.id(), "Mid", 3, "mid", "APPROVED", Instant.parse("2030-02-01T00:00:03Z"));

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews")
                        .param("sort", "highest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews[0].rating").value(5))
                .andExpect(jsonPath("$.data.reviews[1].rating").value(3))
                .andExpect(jsonPath("$.data.reviews[2].rating").value(2));
    }

    @Test
    void publicGetReviews_sortLowest_ordersByRatingAsc() throws Exception {
        TestProductRef product = createPublishedProductCopy("Sort Lowest");
        insertReview(product.id(), "Low", 2, "low", "APPROVED", Instant.parse("2030-03-01T00:00:01Z"));
        insertReview(product.id(), "High", 5, "high", "APPROVED", Instant.parse("2030-03-01T00:00:02Z"));
        insertReview(product.id(), "Mid", 3, "mid", "APPROVED", Instant.parse("2030-03-01T00:00:03Z"));

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews")
                        .param("sort", "lowest"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reviews[0].rating").value(2))
                .andExpect(jsonPath("$.data.reviews[1].rating").value(3))
                .andExpect(jsonPath("$.data.reviews[2].rating").value(5));
    }

    @Test
    void publicGetReviews_invalidRating_returns400() throws Exception {
        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("rating", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("rating", "6"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        mockMvc.perform(get("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .param("rating", "4.2"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
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

    // --- Phase 2F: Anti-abuse guard ---

    @Test
    void publicPostReview_honeypotFilled_returnsSuccessButDoesNotCreateReview() throws Exception {
        long countBefore = reviewRepo.count();

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Bot Honeypot","rating":5,"comment":"Cheap deal","website":"http://spam.example.com"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));

        long countAfter = reviewRepo.count();
        org.assertj.core.api.Assertions.assertThat(countAfter).isEqualTo(countBefore);
    }

    @Test
    void publicPostReview_honeypotWhitespaceOnly_persistsLikeNormal() throws Exception {
        // Whitespace-only honeypot is treated as empty (real user, normal flow).
        long countBefore = reviewRepo.findByProductIdAndStatus(PRODUCT_ID, "PENDING", PageRequest.of(0, 500))
                .getTotalElements();

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van Whitespace HP","rating":3,"comment":"Honeypot blanks ok","website":"   "}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));

        long countAfter = reviewRepo.findByProductIdAndStatus(PRODUCT_ID, "PENDING", PageRequest.of(0, 500))
                .getTotalElements();
        org.assertj.core.api.Assertions.assertThat(countAfter).isEqualTo(countBefore + 1);
    }

    @Test
    void publicPostReview_honeypotAbsent_succeeds() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van Honeypot OK","rating":3,"comment":"Field absent is fine"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));
    }

    @Test
    void publicPostReview_honeypotEmpty_succeeds() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van Honeypot Empty","rating":3,"comment":"Empty string OK","website":""}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.success").value(true));
    }

    @Test
    void publicPostReview_duplicate_sameAuthorComment_returns409() throws Exception {
        String content = """
                {"authorName":"Nguyen Van Dup Guard","rating":4,"comment":"Duplicate guard test","website":""}
                """;

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(content))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(content))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void publicPostReview_duplicateCaseInsensitive_returns409() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van Casing","rating":4,"comment":"Mixed Case Comment","website":""}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"NGUYEN VAN CASING","rating":4,"comment":"mixed CASE comment","website":""}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void publicPostReview_duplicateWhitespaceCollapsed_returns409() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van WS","rating":4,"comment":"Lots of   spaces here","website":""}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"  Nguyen   Van   WS  ","rating":4,"comment":"Lots of spaces here","website":""}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void publicPostReview_sameAuthorDifferentComment_succeeds() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van DiffComment","rating":4,"comment":"Comment one","website":""}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van DiffComment","rating":4,"comment":"Comment two distinct","website":""}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    void publicPostReview_differentAuthorSameComment_succeeds() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van AuthorOne","rating":4,"comment":"Identical comment text","website":""}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van AuthorTwo","rating":4,"comment":"Identical comment text","website":""}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    void publicPostReview_sameAuthorCommentDifferentRating_returns409() throws Exception {
        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van RatingDup","rating":3,"comment":"Rating ignored in dupe","website":""}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van RatingDup","rating":5,"comment":"Rating ignored in dupe","website":""}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void publicPostReview_duplicateOlderThan24h_succeeds() throws Exception {
        insertReview(PRODUCT_ID, "Nguyen Van OldDup", 4, "Old duplicate body", "APPROVED",
                Instant.now().minus(25, ChronoUnit.HOURS));

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van OldDup","rating":4,"comment":"Old duplicate body","website":""}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    void publicPostReview_duplicateAgainstPendingReview_returns409() throws Exception {
        insertReview(PRODUCT_ID, "Nguyen Van PendingDup", 4, "Pending blocks dup", "PENDING");

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van PendingDup","rating":4,"comment":"Pending blocks dup","website":""}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void publicPostReview_duplicateAgainstSpamReview_returns409() throws Exception {
        insertReview(PRODUCT_ID, "Nguyen Van SpamDup", 4, "Spam blocks dup", "SPAM");

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van SpamDup","rating":4,"comment":"Spam blocks dup","website":""}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void publicPostReview_duplicateAgainstTrashReview_returns409() throws Exception {
        insertReview(PRODUCT_ID, "Nguyen Van TrashDup", 4, "Trash blocks dup", "TRASH");

        mockMvc.perform(post("/api/v1/products/" + PRODUCT_ID + "/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"authorName":"Nguyen Van TrashDup","rating":4,"comment":"Trash blocks dup","website":""}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));
    }

    @Test
    void adminPatchStatus_approve_returns200WithApprovedStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "APPROVED"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    @Test
    void adminPatchStatus_spam_returns200WithSpamStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "SPAM"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("SPAM"));
    }

    @Test
    void adminPatchStatus_trash_returns200WithTrashStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "TRASH"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("TRASH"));
    }

    @Test
    void adminPatchStatus_pending_returns200WithPendingStatus() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + spamReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(spamReviewId, "PENDING"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));
    }

    @Test
    void adminPatchStatus_sameState_isNoOp() throws Exception {
        ReviewEntity before = reviewRepo.findById(pendingReviewId).orElseThrow();
        long versionBefore = before.getVersion();
        Instant updatedAtBefore = before.getUpdatedAt();
        long auditCountBefore = countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "PENDING"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.authorEmail").doesNotExist())
                .andExpect(jsonPath("$.data.version").value(versionBefore));

        ReviewEntity after = reviewRepo.findById(pendingReviewId).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(after.getVersion()).isEqualTo(versionBefore);
        org.assertj.core.api.Assertions.assertThat(after.getUpdatedAt()).isEqualTo(updatedAtBefore);
        org.assertj.core.api.Assertions.assertThat(
                countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId)).isEqualTo(auditCountBefore);
        org.mockito.Mockito.verifyNoInteractions(emailDispatchService);
    }

    @Test
    void adminPatchStatus_invalidTransition_returns409WithoutMutation() throws Exception {
        long versionBefore = versionOf(approvedReviewId);
        long auditCountBefore = countReviewAudits("REVIEW_STATUS_CHANGED", approvedReviewId);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + approvedReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(approvedReviewId, "TRASH"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        ReviewEntity after = reviewRepo.findById(approvedReviewId).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(after.getStatus()).isEqualTo("APPROVED");
        org.assertj.core.api.Assertions.assertThat(after.getVersion()).isEqualTo(versionBefore);
        org.assertj.core.api.Assertions.assertThat(
                countReviewAudits("REVIEW_STATUS_CHANGED", approvedReviewId)).isEqualTo(auditCountBefore);
    }

    @Test
    void adminPatchStatus_staleVersion_returns409ConcurrentModification() throws Exception {
        long staleVersion = versionOf(pendingReviewId);
        changeStatus(pendingReviewId, "SPAM");

        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"PENDING\",\"expectedVersion\":" + staleVersion + "}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONCURRENT_MODIFICATION"));

        org.assertj.core.api.Assertions.assertThat(
                reviewRepo.findById(pendingReviewId).orElseThrow().getStatus()).isEqualTo("SPAM");
    }

    @Test
    void adminPatchStatus_approvalEmail_isSentOnlyOnFirstApproval() throws Exception {
        ReviewEntity pending = reviewRepo.findById(pendingReviewId).orElseThrow();
        pending.setAuthorEmail("reviewer@example.test");
        pending.setFirstApprovedAt(null);
        reviewRepo.saveAndFlush(pending);
        org.mockito.Mockito.clearInvocations(emailDispatchService);

        changeStatus(pendingReviewId, "APPROVED");
        Instant firstApprovedAt = reviewRepo.findById(pendingReviewId).orElseThrow().getFirstApprovedAt();
        changeStatus(pendingReviewId, "PENDING");
        changeStatus(pendingReviewId, "APPROVED");

        org.mockito.ArgumentCaptor<org.thymeleaf.context.Context> contextCaptor =
                org.mockito.ArgumentCaptor.forClass(org.thymeleaf.context.Context.class);
        org.mockito.Mockito.verify(emailDispatchService, org.mockito.Mockito.times(1)).send(
                org.mockito.ArgumentMatchers.eq("reviewer@example.test"),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.eq("review-approved"),
                contextCaptor.capture());
        org.assertj.core.api.Assertions.assertThat(
                contextCaptor.getValue().getVariable("productUrl"))
                .isEqualTo("https://bigbike.vn/product/mu-bao-hiem-ls2-ff800/");
        org.assertj.core.api.Assertions.assertThat(
                reviewRepo.findById(pendingReviewId).orElseThrow().getFirstApprovedAt())
                .isEqualTo(firstApprovedAt);
    }

    @Test
    void adminPatchStatus_invalidStatus_returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "HAHA"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void adminPatchStatus_invalidStatus_doesNotCreateAuditLog() throws Exception {
        long countBefore = countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "HAHA"))
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
                        .content(statusBody(pendingReviewId, "APPROVED"))
                        .header("X-Forwarded-For", "192.0.2.250")
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
    void adminPatchStatus_trustedProxyAuditUsesForwardedClientIp() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .with(remoteAddress("127.0.0.1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "APPROVED"))
                        .header("X-Forwarded-For", "198.51.100.77, 127.0.0.1")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk());

        AuditLogEntity auditLog = findLatestReviewAudit(
                "REVIEW_STATUS_CHANGED", pendingReviewId).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(auditLog.getIpAddress())
                .isEqualTo("198.51.100.77");
    }

    @Test
    void adminPatchStatus_auditSnapshotRedactsReviewerContentAndIdentity() throws Exception {
        ReviewEntity review = reviewRepo.findById(pendingReviewId).orElseThrow();
        review.setAuthorName("Tên riêng cần ẩn");
        review.setAuthorEmail("private-reviewer@example.test");
        review.setBody("Nội dung đánh giá riêng cần ẩn");
        review.setPhotos(java.util.List.of("/media/reviews/private/photo.jpg"));
        reviewRepo.saveAndFlush(review);

        changeStatus(pendingReviewId, "APPROVED");

        AuditLogEntity auditLog = findLatestReviewAudit("REVIEW_STATUS_CHANGED", pendingReviewId)
                .orElseThrow();
        String snapshots = String.valueOf(auditLog.getBeforeData())
                + String.valueOf(auditLog.getAfterData());
        org.assertj.core.api.Assertions.assertThat(snapshots)
                .contains("\"productName\":\"LS2 FF800 Storm\"")
                .doesNotContain("Tên riêng cần ẩn")
                .doesNotContain("private-reviewer@example.test")
                .doesNotContain("Nội dung đánh giá riêng cần ẩn")
                .doesNotContain("/media/reviews/private/photo.jpg");
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
                        .content("{\"status\":\"APPROVED\",\"expectedVersion\":0}")
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
                        .content(statusBody(pendingId, "APPROVED"))
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
    void adminPatchStatus_returnApprovedToPending_syncsProductRatingCache() throws Exception {
        TestProductRef product = createPublishedProductCopy("Rating Sync Trash");
        Long approvedId = insertReview(product.id(), "Approved Review", 5, "Great", "APPROVED");
        setProductRatingCache(product.id(), new BigDecimal("4.8"), 88);

        mockMvc.perform(patch("/api/v1/admin/reviews/" + approvedId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(approvedId, "PENDING"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PENDING"));

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avgRating").value(0.0))
                .andExpect(jsonPath("$.data.totalReviews").value(0));

        mockMvc.perform(get("/api/v1/products/" + product.slug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(product.id()))
                // Product detail omits a null rating from the JSON (NON_NULL serialization) —
                // the field is absent, not present-as-null (stale expectation, AUD-046).
                .andExpect(jsonPath("$.data.rating").doesNotExist())
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

        changeStatus(approvedId, "PENDING");
        changeStatus(approvedId, "TRASH");

        mockMvc.perform(delete("/api/v1/admin/reviews/" + approvedId)
                        .param("expectedVersion", String.valueOf(versionOf(approvedId)))
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/products/" + product.id() + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.avgRating").value(0.0))
                .andExpect(jsonPath("$.data.totalReviews").value(0));

        mockMvc.perform(get("/api/v1/products/" + product.slug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(product.id()))
                // Product detail omits a null rating from the JSON (NON_NULL serialization) —
                // the field is absent, not present-as-null (stale expectation, AUD-046).
                .andExpect(jsonPath("$.data.rating").doesNotExist())
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
        changeStatus(toDelete, "TRASH");

        mockMvc.perform(delete("/api/v1/admin/reviews/" + toDelete)
                        .param("expectedVersion", String.valueOf(versionOf(toDelete)))
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
                .andExpect(status().isNoContent());

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(toDelete)).isEmpty();
    }

    @Test
    void adminDeleteReview_nonTrash_returns409() throws Exception {
        mockMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .param("expectedVersion", String.valueOf(versionOf(pendingReviewId)))
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(pendingReviewId)).isPresent();
    }

    @Test
    void adminDeleteReview_nonSuperAdmin_returns403() throws Exception {
        changeStatus(pendingReviewId, "TRASH");

        mockMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .param("expectedVersion", String.valueOf(versionOf(pendingReviewId)))
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "ADMIN"))
                .andExpect(status().isForbidden());

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(pendingReviewId)).isPresent();
    }

    @Test
    void adminDeleteReview_staleVersion_returns409ConcurrentModification() throws Exception {
        changeStatus(pendingReviewId, "TRASH");
        long staleVersion = versionOf(pendingReviewId) - 1;

        mockMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .param("expectedVersion", String.valueOf(staleVersion))
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONCURRENT_MODIFICATION"));

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(pendingReviewId)).isPresent();
    }

    @Test
    void adminDeleteReview_writesAuditLog() throws Exception {
        Long toDelete = insertReview(PRODUCT_ID, "To Delete With Audit", 2, "Will be deleted", "PENDING");
        changeStatus(toDelete, "TRASH");

        mockMvc.perform(delete("/api/v1/admin/reviews/" + toDelete)
                        .param("expectedVersion", String.valueOf(versionOf(toDelete)))
                        .with(remoteAddress("198.51.100.25"))
                        .header("User-Agent", "Phase2C-Delete-Agent")
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
                .andExpect(status().isNoContent());

        AuditLogEntity auditLog = findLatestReviewAudit("REVIEW_DELETED", toDelete)
                .orElseThrow(() -> new AssertionError("Expected review delete audit log."));

        org.assertj.core.api.Assertions.assertThat(auditLog.getActorType()).isEqualTo("ADMIN");
        org.assertj.core.api.Assertions.assertThat(auditLog.getActorId()).isEqualTo(DEV_ADMIN_ID);
        org.assertj.core.api.Assertions.assertThat(auditLog.getResourceType()).isEqualTo("REVIEW");
        org.assertj.core.api.Assertions.assertThat(auditLog.getBeforeData()).contains("\"id\":" + toDelete);
        org.assertj.core.api.Assertions.assertThat(auditLog.getBeforeData()).contains("\"status\":\"TRASH\"");
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
                        .param("expectedVersion", "0")
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
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
    void adminListReviews_filterByRating_returnsFilteredPaginationTotal() throws Exception {
        Long filteredId = insertReview(PRODUCT_ID, "RatingFilterUnique", 1, "Only this review", "PENDING");

        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("q", "RatingFilterUnique")
                        .param("rating", "1")
                        .param("page", "1")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(filteredId))
                .andExpect(jsonPath("$.data[0].rating").value(1))
                .andExpect(jsonPath("$.pagination.totalItems").value(1));
    }

    @Test
    void adminListReviews_invalidStatusAndHalfStepRating_return400() throws Exception {
        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("status", "UNKNOWN")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));

        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("rating", "4.2")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void adminListReviews_searchTreatsWildcardsAsLiteral() throws Exception {
        Long literalId = insertReview(
                PRODUCT_ID, "Literal %_! Marker", 2, "Literal search", "PENDING");

        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("q", "%_!")
                        .param("page", "1")
                        .param("size", "20")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1))
                .andExpect(jsonPath("$.data[0].id").value(literalId));
    }

    @Test
    void adminReviewListOmitsEmail_detailIncludesEmailAndVersion() throws Exception {
        ReviewEntity review = reviewRepo.findById(pendingReviewId).orElseThrow();
        review.setAuthorEmail("detail-only@example.test");
        reviewRepo.saveAndFlush(review);

        mockMvc.perform(get("/api/v1/admin/reviews")
                        .param("q", "Reviewer PENDING")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].authorEmail").doesNotExist())
                .andExpect(jsonPath("$.data[0].version").isNumber());

        mockMvc.perform(get("/api/v1/admin/reviews/" + pendingReviewId)
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authorEmail").value("detail-only@example.test"))
                .andExpect(jsonPath("$.data.version").isNumber());

        mockMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "SPAM"))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.authorEmail").doesNotExist())
                .andExpect(jsonPath("$.data.version").isNumber());
    }

    @Test
    void adminReviewSummary_countsApprovedAndPendingGlobally() throws Exception {
        long approvedBefore = reviewRepo.countByStatus("APPROVED");
        long pendingBefore = reviewRepo.countByStatus("PENDING");
        long pendingOneStarBefore = reviewRepo.countByStatusAndRating("PENDING", new BigDecimal("1.0"));

        insertReview(PRODUCT_ID, "Summary Approved", 1, "Public score", "APPROVED");
        insertReview(PRODUCT_ID, "Summary Approved 2", 5, "Public score", "APPROVED");
        insertReview(PRODUCT_ID, "Summary Pending", 1, "Queue", "PENDING");
        insertReview(PRODUCT_ID, "Summary Spam", 1, "Ignored", "SPAM");

        mockMvc.perform(get("/api/v1/admin/reviews/summary")
                        .header("X-Admin-Permissions", "reviews.read"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.approved.totalReviews").value(approvedBefore + 2))
                .andExpect(jsonPath("$.data.approved.averageRating").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown.length()").value(9))
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['1']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['1.5']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['2']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['2.5']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['3']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['3.5']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['4']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['4.5']").isNumber())
                .andExpect(jsonPath("$.data.approved.ratingBreakdown['5']").isNumber())
                .andExpect(jsonPath("$.data.pending.totalReviews").value(pendingBefore + 1))
                .andExpect(jsonPath("$.data.pending.oneStarReviews").value(pendingOneStarBefore + 1));
    }

    @Test
    void adminBulkReviewActions_updateStatusAndPermanentlyDelete() throws Exception {
        Long first = insertReview(PRODUCT_ID, "Bulk First", 2, "Bulk", "PENDING");
        Long second = insertReview(PRODUCT_ID, "Bulk Second", 3, "Bulk", "PENDING");

        mockMvc.perform(post("/api/v1/admin/reviews/bulk-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkStatusBody("APPROVED", first, second))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.affected").value(2));

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(first).orElseThrow().getStatus()).isEqualTo("APPROVED");
        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(second).orElseThrow().getStatus()).isEqualTo("APPROVED");

        mockMvc.perform(post("/api/v1/admin/reviews/bulk-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkStatusBody("PENDING", first, second))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.affected").value(2));

        mockMvc.perform(post("/api/v1/admin/reviews/bulk-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkStatusBody("TRASH", first, second))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.affected").value(2));

        mockMvc.perform(post("/api/v1/admin/reviews/bulk-delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(bulkDeleteBody(first, second))
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.affected").value(2));

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(first)).isEmpty();
        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(second)).isEmpty();
    }

    @Test
    void adminBulkStatus_isBestEffortAndReportsEverySkipReason() throws Exception {
        Long first = insertReview(PRODUCT_ID, "Bulk Valid", 2, "Bulk", "PENDING");
        Long stale = insertReview(PRODUCT_ID, "Bulk Stale", 3, "Bulk", "PENDING");
        long missing = reviewRepo.findAll().stream()
                .map(ReviewEntity::getId)
                .max(Long::compareTo)
                .orElse(0L) + 900_000L;
        String body = """
                {"items":[
                  {"id":%d,"expectedVersion":%d},
                  {"id":%d,"expectedVersion":%d},
                  {"id":%d,"expectedVersion":%d},
                  {"id":%d,"expectedVersion":%d},
                  {"id":%d,"expectedVersion":0},
                  {"id":%d,"expectedVersion":%d}
                ],"status":"SPAM"}
                """.formatted(
                first, versionOf(first),
                first, versionOf(first),
                stale, versionOf(stale) + 99,
                approvedReviewId, versionOf(approvedReviewId),
                missing,
                spamReviewId, versionOf(spamReviewId));

        mockMvc.perform(post("/api/v1/admin/reviews/bulk-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.affected").value(1))
                .andExpect(jsonPath("$.data.skipped[0].reason").value("DUPLICATE_ID"))
                .andExpect(jsonPath("$.data.skipped[1].reason").value("VERSION_CONFLICT"))
                .andExpect(jsonPath("$.data.skipped[2].reason").value("INVALID_TRANSITION"))
                .andExpect(jsonPath("$.data.skipped[3].reason").value("NOT_FOUND"))
                .andExpect(jsonPath("$.data.skipped[4].reason").value("NO_CHANGE"));

        org.assertj.core.api.Assertions.assertThat(
                reviewRepo.findById(first).orElseThrow().getStatus()).isEqualTo("SPAM");
        org.assertj.core.api.Assertions.assertThat(
                reviewRepo.findById(stale).orElseThrow().getStatus()).isEqualTo("PENDING");
    }

    @Test
    void adminBulkDelete_isBestEffortAndRequiresTrashPerItem() throws Exception {
        Long trash = insertReview(PRODUCT_ID, "Bulk Trash", 2, "Bulk", "PENDING");
        String uniquePhoto = "/media/reviews/bulk/unique.jpg";
        String sharedPhoto = "/media/reviews/bulk/shared.jpg";
        ReviewEntity trashReview = reviewRepo.findById(trash).orElseThrow();
        trashReview.setPhotos(java.util.List.of(uniquePhoto, sharedPhoto));
        reviewRepo.saveAndFlush(trashReview);
        ReviewEntity stillReferenced = reviewRepo.findById(pendingReviewId).orElseThrow();
        stillReferenced.setPhotos(java.util.List.of(sharedPhoto));
        reviewRepo.saveAndFlush(stillReferenced);
        changeStatus(trash, "TRASH");
        long trashVersion = versionOf(trash);
        long missing = reviewRepo.findAll().stream()
                .map(ReviewEntity::getId)
                .max(Long::compareTo)
                .orElse(0L) + 800_000L;
        String body = """
                {"items":[
                  {"id":%d,"expectedVersion":%d},
                  {"id":%d,"expectedVersion":%d},
                  {"id":%d,"expectedVersion":%d},
                  {"id":%d,"expectedVersion":0}
                ]}
                """.formatted(
                trash, trashVersion,
                trash, trashVersion,
                pendingReviewId, versionOf(pendingReviewId),
                missing);

        mockMvc.perform(post("/api/v1/admin/reviews/bulk-delete")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .header("X-Admin-Permissions", "reviews.write")
                        .header("X-Admin-Role", "SUPER_ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.affected").value(1))
                .andExpect(jsonPath("$.data.skipped[0].reason").value("DUPLICATE_ID"))
                .andExpect(jsonPath("$.data.skipped[1].reason").value("NOT_IN_TRASH"))
                .andExpect(jsonPath("$.data.skipped[2].reason").value("NOT_FOUND"));

        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(trash)).isEmpty();
        org.assertj.core.api.Assertions.assertThat(reviewRepo.findById(pendingReviewId)).isPresent();
        org.mockito.Mockito.verify(reviewPhotoStorageService, org.mockito.Mockito.times(1))
                .deletePhotos(org.mockito.ArgumentMatchers.argThat(
                        photos -> photos.size() == 1 && photos.contains(uniquePhoto)));
    }

    @Test
    void adminBulkStatus_nullItem_returns400() throws Exception {
        mockMvc.perform(post("/api/v1/admin/reviews/bulk-status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"items\":[null],\"status\":\"APPROVED\"}")
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
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
                        .content(statusBody(pendingReviewId, "APPROVED"))
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
    void adminReviewSummary_noAuth_returns401() throws Exception {
        secMvc.perform(get("/api/v1/admin/reviews/summary"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminReviewSummary_missingReviewsReadPermission_returns403() throws Exception {
        String editorToken = createActiveAdminAndToken("EDITOR");

        secMvc.perform(get("/api/v1/admin/reviews/summary")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPatchStatus_noAuth_returns401() throws Exception {
        secMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "APPROVED")))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminDeleteReview_noAuth_returns401() throws Exception {
        secMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .param("expectedVersion", String.valueOf(versionOf(pendingReviewId))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminListReviews_missingReviewsReadPermission_returns403() throws Exception {
        String editorToken = createActiveAdminAndToken("EDITOR");

        secMvc.perform(get("/api/v1/admin/reviews")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPatchStatus_missingReviewsWritePermission_returns403() throws Exception {
        String editorToken = createActiveAdminAndToken("EDITOR");

        secMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "APPROVED"))
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminPatchStatus_missingReviewsWritePermission_doesNotCreateAuditLog() throws Exception {
        String editorToken = createActiveAdminAndToken("EDITOR");
        long countBefore = countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId);

        secMvc.perform(patch("/api/v1/admin/reviews/" + pendingReviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(pendingReviewId, "APPROVED"))
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());

        org.assertj.core.api.Assertions.assertThat(countReviewAudits("REVIEW_STATUS_CHANGED", pendingReviewId))
                .isEqualTo(countBefore);
    }

    @Test
    void adminDeleteReview_missingReviewsWritePermission_returns403() throws Exception {
        String editorToken = createActiveAdminAndToken("EDITOR");

        secMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .param("expectedVersion", String.valueOf(versionOf(pendingReviewId)))
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminDeleteReview_missingReviewsWritePermission_doesNotCreateAuditLog() throws Exception {
        String editorToken = createActiveAdminAndToken("EDITOR");
        long countBefore = countReviewAudits("REVIEW_DELETED", pendingReviewId);

        secMvc.perform(delete("/api/v1/admin/reviews/" + pendingReviewId)
                        .param("expectedVersion", String.valueOf(versionOf(pendingReviewId)))
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());

        org.assertj.core.api.Assertions.assertThat(countReviewAudits("REVIEW_DELETED", pendingReviewId))
                .isEqualTo(countBefore);
    }

    private Long insertReview(String productId, String authorName, int rating, String body, String status) {
        return insertReview(productId, authorName, rating, body, status, Instant.now());
    }

    /**
     * JwtAuthFilter re-checks the admin's current status/role against the DB on every request
     * (fixed 2026-07-06, audit IV-01) — a JWT for a non-existent user id is no longer trusted on
     * claims alone, so permission-denial tests need a real ACTIVE admin_users row behind the token.
     */
    private String createActiveAdminAndToken(String role) {
        String email = role.toLowerCase(java.util.Locale.ROOT) + "-" + UUID.randomUUID() + "@bigbike.test";
        Instant now = Instant.now();
        AdminUserEntity admin = new AdminUserEntity();
        admin.setEmail(email);
        admin.setDisplayName("Reviews Test Admin");
        admin.setRole(role);
        admin.setStatus("ACTIVE");
        admin.setCreatedAt(now);
        admin.setUpdatedAt(now);
        AdminUserEntity saved = adminUserRepo.save(admin);
        return jwtService.generateAccessToken(saved.getId().toString(), email, role);
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
        review.setRating(BigDecimal.valueOf(rating));
        review.setBody(body);
        review.setStatus(status);
        if ("APPROVED".equals(status)) {
            review.setFirstApprovedAt(createdAt);
        }
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
        entity.setBrand(source.getBrand());
        entity.setRetailPrice(source.getRetailPrice());
        entity.setSalePrice(source.getSalePrice());
        entity.setCurrency(source.getCurrency());
        entity.setStockState(source.getStockState());
        entity.setStockQuantity(source.getStockQuantity());
        entity.setAvailable(source.getAvailable());
        entity.setPublishStatus(source.getPublishStatus());
        entity.setHomepageBlock(source.getHomepageBlock());
        entity.setHomepageOrder(source.getHomepageOrder());
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

    private long versionOf(Long reviewId) {
        return reviewRepo.findById(reviewId)
                .map(ReviewEntity::getVersion)
                .orElseThrow(() -> new AssertionError("Expected review " + reviewId));
    }

    private String statusBody(Long reviewId, String status) {
        return "{\"status\":\"" + status + "\",\"expectedVersion\":" + versionOf(reviewId) + "}";
    }

    private void changeStatus(Long reviewId, String status) throws Exception {
        mockMvc.perform(patch("/api/v1/admin/reviews/" + reviewId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(statusBody(reviewId, status))
                        .header("X-Admin-Permissions", "reviews.write"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
    }

    private String bulkStatusBody(String status, Long... reviewIds) {
        return "{\"items\":" + versionedItemsJson(reviewIds) + ",\"status\":\"" + status + "\"}";
    }

    private String bulkDeleteBody(Long... reviewIds) {
        return "{\"items\":" + versionedItemsJson(reviewIds) + "}";
    }

    private String versionedItemsJson(Long... reviewIds) {
        StringBuilder body = new StringBuilder("[");
        for (int index = 0; index < reviewIds.length; index++) {
            if (index > 0) {
                body.append(',');
            }
            Long id = reviewIds[index];
            body.append("{\"id\":")
                    .append(id)
                    .append(",\"expectedVersion\":")
                    .append(versionOf(id))
                    .append('}');
        }
        return body.append(']').toString();
    }

    private RequestPostProcessor remoteAddress(String remoteAddress) {
        return request -> {
            request.setRemoteAddr(remoteAddress);
            return request;
        };
    }

    private record TestProductRef(String id, String slug) {}
}
