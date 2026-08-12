package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatAssistantSettingsTest {

    @Test
    @DisplayName("CHAT_RULE_005: recent-turn setting defaults to three, accepts zero and clamps oversized data")
    void recentTurnPairSettingIsRuntimeConfigurableAndBounded() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        ChatAssistantSettings settings = new ChatAssistantSettings(repository);

        when(repository.findAll()).thenReturn(List.of());
        assertThat(settings.load("vi").recentTurnPairs()).isEqualTo(3);

        when(repository.findAll()).thenReturn(List.of(setting("0")));
        assertThat(settings.load("vi").recentTurnPairs()).isZero();

        when(repository.findAll()).thenReturn(List.of(setting("99")));
        assertThat(settings.load("vi").recentTurnPairs()).isEqualTo(3);
    }

    private static SiteSettingEntity setting(String value) {
        SiteSettingEntity setting = new SiteSettingEntity();
        setting.setSettingKey(ChatAssistantSettings.KEY_RECENT_TURN_PAIRS);
        setting.setSettingValue(value);
        return setting;
    }
}
