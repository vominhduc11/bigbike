package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

class ChatStage4ConfigurationTest {

    @Test
    void assistantModelIsReadDynamicallyAndImagesDefaultOff() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        ChatAssistantSettings settings = new ChatAssistantSettings(repository);
        SiteSettingEntity selected = setting(
                ChatAssistantSettings.KEY_MODEL, "gemini-3.5-flash");
        when(repository.findBySettingKey(ChatAssistantSettings.KEY_MODEL))
                .thenReturn(Optional.of(selected));
        when(repository.findAll()).thenReturn(List.of());

        assertThat(settings.currentModel()).isEqualTo("gemini-3.5-flash");
        assertThat(settings.imageSettings()).isEqualTo(
                new ChatAssistantSettings.ImageSettings(false, 20, 3));

        selected.setSettingValue("gemini-2.5-flash-lite");
        assertThat(settings.currentModel()).isEqualTo("gemini-2.5-flash-lite");
    }

    @Test
    void accountDiscoveryFiltersPreviewAndUnpricedModelsAndKeepsReviewModelIndependent() {
        ChatAssistantSettings settings = mock(ChatAssistantSettings.class);
        when(settings.currentModel()).thenReturn("gemini-3.5-flash");
        String providerPayload = """
                {"models":[
                  {"name":"models/gemini-3.5-flash","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-2.5-flash-lite","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-3.5-flash-preview","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-unpriced-flash","supportedGenerationMethods":["generateContent"]},
                  {"name":"models/gemini-2.5-pro","supportedGenerationMethods":["embedContent"]}
                ]}
                """;
        Clock clock = Clock.fixed(
                Instant.parse("2026-08-26T03:00:00Z"), ZoneOffset.UTC);
        GeminiModelCatalogService service = new GeminiModelCatalogService(
                "configured-key",
                "gemini-2.5-flash-lite",
                "gemini-2.5-flash",
                15,
                settings,
                new ChatModelRegistry(),
                () -> providerPayload,
                new ObjectMapper(),
                clock);

        var result = service.catalog(true);

        assertThat(result.currentModel()).isEqualTo("gemini-3.5-flash");
        assertThat(result.fallbackModel()).isEqualTo("gemini-2.5-flash-lite");
        assertThat(result.reviewModerationModel()).isEqualTo("gemini-2.5-flash");
        assertThat(result.stale()).isFalse();
        assertThat(result.models()).filteredOn(item -> item.selectable())
                .extracting(item -> item.id())
                .containsExactlyInAnyOrder("gemini-3.5-flash", "gemini-2.5-flash-lite");
        assertThat(result.models()).filteredOn(item -> item.selectable())
                .allSatisfy(item -> {
                    assertThat(item.speedDescriptionVi()).isNotBlank();
                    assertThat(item.speedDescriptionEn()).isNotBlank();
                    assertThat(item.costDescriptionVi()).isNotBlank();
                    assertThat(item.costDescriptionEn()).isNotBlank();
                    assertThat(item.inputUsdPerMillion()).isPositive();
                    assertThat(item.outputUsdPerMillion()).isPositive();
                    assertThat(item.pricingSource())
                            .isEqualTo(ChatModelRegistry.PRICING_SOURCE);
                });

        when(settings.currentModel()).thenReturn("gemini-2.5-flash-lite");
        var changed = service.catalog(false);
        assertThat(changed.currentModel()).isEqualTo("gemini-2.5-flash-lite");
        assertThat(changed.reviewModerationModel()).isEqualTo("gemini-2.5-flash");

        assertThatThrownBy(() -> service.requirePrice(
                "gemini-model-without-verified-price", clock.instant()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("requested model");
    }

    @Test
    void evaluationDatasetIsVersionedCoversAllAcceptanceIdsAndRedactsDraftPii() {
        ChatEvaluationDatasetService service = new ChatEvaluationDatasetService(new ObjectMapper());

        ChatEvaluationDatasetService.Dataset dataset = service.require("phase4-acceptance-v1");

        assertThat(dataset.checksum()).hasSize(64);
        assertThat(dataset.cases()).isNotEmpty();
        assertThat(dataset.cases()).extracting(item -> item.locale())
                .contains("vi", "en");
        assertThat(dataset.acceptanceCoverage()).hasSize(85)
                .contains("PHASE1-01", "PHASE1-10", "PHASE2-01", "PHASE2-26",
                        "PHASE3-01", "PHASE3-27", "PHASE4-01", "PHASE4-22");

        String draft = service.draftFromQuestions(List.of(
                "Tôi là Nguyễn Văn A, gọi 0912 345 678, email khach@example.com, "
                        + "mã đơn 550e8400-e29b-41d4-a716-446655440000"));
        assertThat(draft)
                .contains("DRAFT_REQUIRES_HUMAN_VERIFICATION", "expectedNumbers",
                        "forbiddenTerms", "requiredTopics", "verifiedGroundTruth")
                .doesNotContain("Nguyễn Văn A", "0912 345 678", "khach@example.com",
                        "550e8400-e29b-41d4-a716-446655440000");
    }

    private static SiteSettingEntity setting(String key, String value) {
        SiteSettingEntity setting = new SiteSettingEntity();
        setting.setSettingKey(key);
        setting.setSettingValue(value);
        return setting;
    }
}
