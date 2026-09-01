package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.bigbike.bigbike_backend.service.content.FrozenStorePolicyContent;
import com.bigbike.bigbike_backend.service.content.StorePolicyService;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatAssistantSettingsTest {

    @Test
    @DisplayName("CHAT_RULE_005: recent-turn setting defaults to twelve, accepts zero and clamps oversized data")
    void recentTurnPairSettingIsRuntimeConfigurableAndBounded() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        ChatAssistantSettings settings = settings(repository);

        when(repository.findAll()).thenReturn(List.of());
        assertThat(settings.load("vi").recentTurnPairs()).isEqualTo(12);

        when(repository.findAll()).thenReturn(List.of(setting("0")));
        assertThat(settings.load("vi").recentTurnPairs()).isZero();

        when(repository.findAll()).thenReturn(List.of(setting("99")));
        assertThat(settings.load("vi").recentTurnPairs()).isEqualTo(12);
    }

    @Test
    void defaultsToFourHundredAiTurnsAndKeepsImageQuotasOutOfOwnerSettings() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        when(repository.findAll()).thenReturn(List.of());

        ChatAssistantSettings.Snapshot snapshot = settings(repository).load("vi");

        assertThat(snapshot.dailyLimit()).isEqualTo(400);
        assertThat(settings(repository).imageSettings())
                .isEqualTo(new ChatAssistantSettings.ImageSettings(true, 20, 3));
    }

    @Test
    void policySnapshotUsesTheSameFrozenDocumentsAsThePublicPolicyService() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        when(repository.findAll()).thenReturn(List.of(
                setting("policy_warranty_title", "Old title"),
                setting("policy_warranty_body_html", "Old body")));
        StorePolicyService policyService = new StorePolicyService(
                repository, new FrozenStorePolicyContent());
        ChatAssistantSettings assistantSettings = new ChatAssistantSettings(repository, policyService);

        var vi = assistantSettings.load("vi");
        var en = assistantSettings.load("en");

        assertThat(vi.warrantyPolicy().title()).isEqualTo("Chính sách bảo hành");
        assertThat(vi.warrantyPolicy().text())
                .isEqualTo(policyService.plainText("warranty", "vi"))
                .contains("24 tháng")
                .doesNotContain("Old body");
        assertThat(en.returnExchangePolicy().text())
                .isEqualTo(policyService.plainText("return-exchange", "en"))
                .contains("7 days");
    }

    private static ChatAssistantSettings settings(SiteSettingJpaRepository repository) {
        return new ChatAssistantSettings(repository, new StorePolicyService(
                repository, new FrozenStorePolicyContent()));
    }

    private static SiteSettingEntity setting(String value) {
        return setting(ChatAssistantSettings.KEY_RECENT_TURN_PAIRS, value);
    }

    private static SiteSettingEntity setting(String key, String value) {
        SiteSettingEntity setting = new SiteSettingEntity();
        setting.setSettingKey(key);
        setting.setSettingValue(value);
        return setting;
    }

}
