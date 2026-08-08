package com.bigbike.bigbike_backend.service.review;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Pins the shape of the outbound Gemini request (REVIEW_RULE_013).
 *
 * <p>Three things here are cost or privacy controls rather than cosmetics, so they are
 * asserted rather than left to a comment: thinking is switched off, the comment is capped,
 * and nothing about the customer's identity is attached.
 */
class AiReviewModerationRequestShapeTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AiReviewModerationClient client() {
        return new AiReviewModerationClient("test-key", "gemini-2.5-flash", 20L);
    }

    private static Map<String, Object> body(String comment, BigDecimal rating) {
        return client().buildRequestBody(comment, rating);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> generationConfig(Map<String, Object> body) {
        return (Map<String, Object>) body.get("generationConfig");
    }

    @Test
    @DisplayName("thinking is switched off — it is billed as output and buys nothing here")
    void thinkingBudgetIsZero() {
        Map<String, Object> config = generationConfig(body("Mũ đẹp, giao nhanh.", new BigDecimal("5.0")));

        assertThat(config.get("thinkingConfig")).isEqualTo(Map.of("thinkingBudget", 0));
        assertThat(config.get("maxOutputTokens")).isEqualTo(512);
    }

    @Test
    @DisplayName("the reply is constrained to the JSON schema, listing every category")
    void responseSchemaListsEveryCategory() throws Exception {
        Map<String, Object> config = generationConfig(body("Nội dung.", new BigDecimal("3.0")));

        assertThat(config.get("responseMimeType")).isEqualTo("application/json");
        String schema = MAPPER.writeValueAsString(config.get("responseSchema"));
        for (ReviewModerationCategory category : ReviewModerationCategory.values()) {
            assertThat(schema).contains(category.name());
        }
        assertThat(schema).contains("violation").contains("categories").contains("reason");
    }

    @Test
    @DisplayName("only the comment and the rating leave the system")
    void requestCarriesNoCustomerIdentity() throws Exception {
        Map<String, Object> body = body("Sản phẩm ổn.", new BigDecimal("4.0"));

        // Exactly one user turn: nothing else can be smuggled alongside the comment.
        assertThat((List<?>) body.get("contents")).hasSize(1);
        String json = MAPPER.writeValueAsString(body);
        assertThat(json).contains("Sản phẩm ổn").contains("4.0");
        assertThat(json).doesNotContain("authorName")
                .doesNotContain("authorEmail")
                .doesNotContain("customerId")
                .doesNotContain("photos");
    }

    @Test
    @DisplayName("an over-long comment is truncated instead of rejected")
    void longCommentIsTruncated() throws Exception {
        String longComment = "a".repeat(9_000);

        String json = MAPPER.writeValueAsString(body(longComment, new BigDecimal("3.0")));

        assertThat(json).contains("a".repeat(4_000));
        assertThat(json).doesNotContain("a".repeat(4_001));
    }

    @Test
    @DisplayName("a missing rating does not break the request")
    void nullRatingIsTolerated() throws Exception {
        String json = MAPPER.writeValueAsString(body("Nội dung.", null));

        assertThat(json).contains("không rõ");
    }

    @Test
    @DisplayName("no credential configured means no call is attempted")
    void unconfiguredClientNeverCallsOut() {
        AiReviewModerationClient unconfigured =
                new AiReviewModerationClient("  ", "gemini-2.5-flash", 20L);

        assertThat(unconfigured.isConfigured()).isFalse();
        assertThat(unconfigured.classify("bất kỳ nội dung nào", new BigDecimal("1.0"))).isEmpty();
    }

    @Test
    @DisplayName("blank comment short-circuits before any network work")
    void blankCommentIsNotSent() {
        assertThat(client().classify("   ", new BigDecimal("1.0"))).isEmpty();
        assertThat(client().classify(null, new BigDecimal("1.0"))).isEmpty();
    }

    @Test
    @DisplayName("unknown category names from the provider are ignored, not trusted")
    void unknownCategoriesAreDropped() {
        assertThat(ReviewModerationCategory.parse("PROFANITY"))
                .contains(ReviewModerationCategory.PROFANITY);
        assertThat(ReviewModerationCategory.parse("profanity"))
                .contains(ReviewModerationCategory.PROFANITY);
        assertThat(ReviewModerationCategory.parse("SOMETHING_NEW")).isEmpty();
        assertThat(ReviewModerationCategory.parse(null)).isEmpty();
        assertThat(List.of(ReviewModerationCategory.values())).hasSize(4);
    }
}
