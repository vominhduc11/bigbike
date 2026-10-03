package com.bigbike.bigbike_backend.service.review;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.admin.AdminReviewService;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Exercises the real settings reader with the moderator, without runtime data or AI calls. */
@ExtendWith(MockitoExtension.class)
class ReviewModerationSettingsTest {

    @Mock private SiteSettingJpaRepository settingRepo;
    @Mock private ReviewJpaRepository reviewRepo;
    @Mock private AiReviewModerationClient aiClient;
    @Mock private AdminReviewService adminReviewService;

    private final Map<String, SiteSettingEntity> rows = new HashMap<>();

    @BeforeEach
    void setUp() {
        when(settingRepo.findBySettingKey(anyString()))
                .thenAnswer(call -> Optional.ofNullable(rows.get(call.getArgument(0))));
    }

    static Stream<Arguments> legacyFlagsAndCategories() {
        return Stream.of(null, "false", "true", "invalid")
                .flatMap(value -> Stream.of(ReviewModerationCategory.values())
                        .map(category -> Arguments.of(value, category)));
    }

    @ParameterizedTest
    @MethodSource("legacyFlagsAndCategories")
    void legacyFlagsCannotDisableAnyCategoryAfterRestartOrFreshInstall(
            String value, ReviewModerationCategory category) {
        if (value != null) {
            put("review_moderation_enabled", value);
            for (ReviewModerationCategory item : ReviewModerationCategory.values()) {
                put(item.settingKey(), value);
            }
        }
        Map<String, SiteSettingEntity> originalRows = Map.copyOf(rows);
        ReviewEntity review = new ReviewEntity();
        review.setStatus("PENDING");
        review.setBody("Nội dung cần kiểm duyệt.");
        review.setRating(new BigDecimal("4.5"));
        when(reviewRepo.findById(42L)).thenReturn(Optional.of(review));
        when(aiClient.isConfigured()).thenReturn(true);
        when(aiClient.classify(review.getBody(), review.getRating())).thenReturn(Optional.of(
                new AiReviewModerationClient.AiVerdict(true, List.of(category), "Vi phạm.")));

        // Recreate both components to model a restart; absent rows model a fresh installation.
        for (int attempt = 0; attempt < 2; attempt++) {
            new ReviewModerationService(reviewRepo, new ReviewModerationSettings(settingRepo),
                    aiClient, adminReviewService).moderate(42L);
        }

        ArgumentCaptor<ReviewModerationOutcome> outcomes =
                ArgumentCaptor.forClass(ReviewModerationOutcome.class);
        verify(adminReviewService, times(2)).applyAutoModeration(eq(42L), outcomes.capture());
        assertThat(outcomes.getAllValues()).allSatisfy(outcome -> {
            assertThat(outcome.source()).isEqualTo("AI");
            assertThat(outcome.blocked()).isTrue();
            assertThat(outcome.resolvedTargetStatus()).contains(
                    category == ReviewModerationCategory.ADVERTISING ? "SPAM" : "TRASH");
        });
        verify(aiClient, times(2)).classify(review.getBody(), review.getRating());
        verify(settingRepo, times(2)).findBySettingKey(ReviewModerationSettings.KEY_BANNED_WORDS);
        verify(settingRepo, times(2)).findBySettingKey(ReviewModerationSettings.KEY_DAILY_LIMIT);
        verifyNoMoreInteractions(settingRepo);
        assertThat(rows).containsExactlyInAnyOrderEntriesOf(originalRows);
    }

    static Stream<Arguments> dailyLimits() {
        return Stream.of(Arguments.of(null, 200), Arguments.of("", 200),
                Arguments.of("invalid", 200), Arguments.of("-1", 200),
                Arguments.of("0", 0), Arguments.of("37", 37));
    }

    @ParameterizedTest
    @MethodSource("dailyLimits")
    void storedBudgetIsPreservedWithTheExistingSafeFallback(String value, int expected) {
        if (value != null) put(ReviewModerationSettings.KEY_DAILY_LIMIT, value);
        put(ReviewModerationSettings.KEY_BANNED_WORDS, "lừa đảo, từ cấm");

        var snapshot = new ReviewModerationSettings(settingRepo).load();

        assertThat(snapshot.dailyLimit()).isEqualTo(expected);
        assertThat(snapshot.bannedWordsRaw()).isEqualTo("lừa đảo, từ cấm");
        if (value != null) {
            assertThat(rows.get(ReviewModerationSettings.KEY_DAILY_LIMIT).getSettingValue())
                    .isEqualTo(value);
        }
        verify(settingRepo).findBySettingKey(ReviewModerationSettings.KEY_BANNED_WORDS);
        verify(settingRepo).findBySettingKey(ReviewModerationSettings.KEY_DAILY_LIMIT);
        verifyNoMoreInteractions(settingRepo);
    }

    @Test
    void restartingDoesNotResetStoredWordsOrBudget() {
        put(ReviewModerationSettings.KEY_BANNED_WORDS, "từ cấm");
        put(ReviewModerationSettings.KEY_DAILY_LIMIT, "37");

        var before = new ReviewModerationSettings(settingRepo).load();
        var after = new ReviewModerationSettings(settingRepo).load();

        assertThat(after).isEqualTo(before);
        assertThat(after.dailyLimit()).isEqualTo(37);
        assertThat(after.bannedWordsRaw()).isEqualTo("từ cấm");
    }

    private void put(String key, String value) {
        SiteSettingEntity row = new SiteSettingEntity();
        row.setSettingKey(key);
        row.setSettingValue(value);
        rows.put(key, row);
    }
}
