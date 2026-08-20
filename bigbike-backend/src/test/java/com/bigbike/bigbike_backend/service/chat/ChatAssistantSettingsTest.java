package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatAssistantSettingsTest {

    @Test
    @DisplayName("CHAT_RULE_005: recent-turn setting defaults to twelve, accepts zero and clamps oversized data")
    void recentTurnPairSettingIsRuntimeConfigurableAndBounded() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        ChatAssistantSettings settings = new ChatAssistantSettings(repository);

        when(repository.findAll()).thenReturn(List.of());
        assertThat(settings.load("vi").recentTurnPairs()).isEqualTo(12);

        when(repository.findAll()).thenReturn(List.of(setting("0")));
        assertThat(settings.load("vi").recentTurnPairs()).isZero();

        when(repository.findAll()).thenReturn(List.of(setting("99")));
        assertThat(settings.load("vi").recentTurnPairs()).isEqualTo(12);
    }

    @Test
    void defaultsToFourHundredAiTurnsAndZeroMonthlyWarning() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        when(repository.findAll()).thenReturn(List.of());

        ChatAssistantSettings.Snapshot snapshot = new ChatAssistantSettings(repository).load("vi");

        assertThat(snapshot.dailyLimit()).isEqualTo(400);
        assertThat(snapshot.monthlyCostWarningUsd()).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void aliasesAreLocaleScopedAndTemplatesChooseOneUniqueLongestTrigger() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        when(repository.findAll()).thenReturn(List.of(
                setting(ChatAssistantSettings.KEY_ABBREVIATIONS,
                        """
                        [{"locale":"vi","phrase":"nón ff","expansion":"mũ fullface","enabled":true},
                         {"locale":"en","phrase":"ff lid","expansion":"full-face helmet","enabled":true}]
                        """),
                setting(ChatAssistantSettings.KEY_ANSWER_TEMPLATES,
                        """
                        [{"id":"care","topic":"care","enabled":true,
                          "triggersVi":["vệ sinh","vệ sinh mũ"],"triggersEn":["clean helmet"],
                          "answerVi":"Anh/chị lau nhẹ bằng khăn mềm.",
                          "answerEn":"Please wipe it gently with a soft cloth."}]
                        """)));

        ChatAssistantSettings settings = new ChatAssistantSettings(repository);
        ChatAssistantSettings.Snapshot vi = settings.load("vi");
        ChatAssistantSettings.Snapshot en = settings.load("en");

        assertThat(vi.abbreviationMap("vi")).containsEntry("non ff", "mu fullface");
        assertThat(vi.abbreviationMap("en")).doesNotContainKey("non ff");
        assertThat(en.abbreviationMap("en")).containsEntry("ff lid", "full-face helmet");
        assertThat(vi.matchAnswerTemplate("Cách vệ sinh mũ?", "vi"))
                .contains("Anh/chị lau nhẹ bằng khăn mềm.");
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
