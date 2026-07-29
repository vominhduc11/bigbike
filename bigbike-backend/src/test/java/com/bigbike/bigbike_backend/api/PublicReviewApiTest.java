package com.bigbike.bigbike_backend.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.bigbike.bigbike_backend.domain.customer.CustomerPrincipal;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewPhotoUploadEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewPhotoUploadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
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
    @Autowired ReviewJpaRepository reviewRepo;
    @Autowired ReviewPhotoUploadJpaRepository reviewPhotoUploadRepo;
    @Autowired CustomerJpaRepository customerRepo;

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

    @Test
    void submitReview_authenticatedCustomer_ignoresForgedBodyIdentity() throws Exception {
        CustomerEntity customer = new CustomerEntity();
        customer.setEmail("real-account-" + UUID.randomUUID() + "@example.test");
        customer.setDisplayName("Tên tài khoản thật");
        customer.setStatus("ACTIVE");
        customer.setSynthetic(false);
        customer.setCreatedAt(Instant.now());
        customer.setUpdatedAt(Instant.now());
        customer = customerRepo.saveAndFlush(customer);

        CustomerPrincipal principal = new CustomerPrincipal(
                customer.getId(), customer.getEmail(), null, UUID.randomUUID());
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, List.of()));
        try {
            mockMvc.perform(post(REVIEWS_URL)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "authorName": "Tên giả",
                                      "authorEmail": "not-an-email",
                                      "rating": 4.5,
                                      "comment": "Danh tính phải lấy từ tài khoản."
                                    }
                                    """))
                    .andExpect(status().isCreated());
        } finally {
            SecurityContextHolder.clearContext();
        }

        UUID customerId = customer.getId();
        var saved = reviewRepo.findAll().stream()
                .filter(review -> customerId.equals(review.getCustomerId()))
                .max(java.util.Comparator.comparingLong(review -> review.getId()))
                .orElseThrow();
        assertThat(saved.getAuthorName()).isEqualTo("Tên tài khoản thật");
        assertThat(saved.getAuthorEmail()).isEqualTo(customer.getEmail());
        assertThat(saved.getStatus()).isEqualTo("PENDING");
    }

    @Test
    void submitReview_guestInvalidEmail_returns400() throws Exception {
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "authorName": "Khách",
                                  "authorEmail": "not-an-email",
                                  "rating": 4,
                                  "comment": "Email khách phải hợp lệ."
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("VALIDATION_ERROR"));
    }

    @Test
    void submitReview_claimsRegisteredPhotoExactlyOnce() throws Exception {
        String url = registerPhotoUpload(PRODUCT_ID);
        String firstAuthor = "PhotoAuthor-" + UUID.randomUUID();

        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody(firstAuthor, "First photo claim", url)))
                .andExpect(status().isCreated());

        ReviewPhotoUploadEntity claimed = reviewPhotoUploadRepo.findById(objectKey(url)).orElseThrow();
        assertThat(claimed.getClaimedAt()).isNotNull();
        assertThat(claimed.getReviewId()).isNotNull();
        assertThat(reviewRepo.findById(claimed.getReviewId()).orElseThrow().getPhotos())
                .containsExactly(url);

        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody(
                                "SecondPhotoAuthor-" + UUID.randomUUID(),
                                "Second claim must fail",
                                url)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("CONFLICT"));

        assertThat(reviewPhotoUploadRepo.findById(objectKey(url)).orElseThrow().getReviewId())
                .isEqualTo(claimed.getReviewId());
    }

    @Test
    void submitReview_unregisteredOrCrossProductPhoto_returns409() throws Exception {
        String unregistered = "/media/reviews/" + UUID.randomUUID() + "/unregistered.jpg";
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody(
                                "Unregistered-" + UUID.randomUUID(),
                                "No upload record",
                                unregistered)))
                .andExpect(status().isConflict());

        String crossProduct = registerPhotoUpload("another-product");
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(reviewBody(
                                "CrossProduct-" + UUID.randomUUID(),
                                "Wrong product",
                                crossProduct)))
                .andExpect(status().isConflict());
    }

    @Test
    void submitReview_nullBlankOrWrongPhotoPath_returns400() throws Exception {
        String author = "InvalidPhoto-" + UUID.randomUUID();
        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"" + author
                                + "\",\"rating\":4,\"comment\":\"Null photo\",\"photos\":[null]}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"" + author
                                + "-blank\",\"rating\":4,\"comment\":\"Blank photo\",\"photos\":[\"  \"]}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post(REVIEWS_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"" + author
                                + "-wrong\",\"rating\":4,\"comment\":\"Wrong photo\","
                                + "\"photos\":[\"/media/products/not-review.jpg\"]}"))
                .andExpect(status().isBadRequest());
    }

    private String registerPhotoUpload(String productId) {
        String unique = UUID.randomUUID().toString();
        String url = "/media/reviews/" + unique + "/photo.jpg";
        ReviewPhotoUploadEntity upload = new ReviewPhotoUploadEntity();
        upload.setObjectKey(objectKey(url));
        upload.setPublicUrl(url);
        upload.setProductId(productId);
        upload.setUploadedAt(Instant.now());
        reviewPhotoUploadRepo.saveAndFlush(upload);
        return url;
    }

    private String reviewBody(String author, String comment, String photoUrl) {
        return "{\"authorName\":\"" + author + "\",\"rating\":4,\"comment\":\""
                + comment + "\",\"photos\":[\"" + photoUrl + "\"]}";
    }

    private String objectKey(String url) {
        return url.substring("/media/".length());
    }
}
