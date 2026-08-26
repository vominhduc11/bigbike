package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ChatPhase3SettingsTest {

    private final Map<String, SiteSettingEntity> values = new ConcurrentHashMap<>();
    private ChatPhase3Settings settings;

    @BeforeEach
    void setUp() {
        SiteSettingJpaRepository repository = mock(SiteSettingJpaRepository.class);
        when(repository.findBySettingKey(org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(invocation -> Optional.ofNullable(values.get(invocation.getArgument(0))));
        settings = new ChatPhase3Settings(repository);
    }

    @Test
    @DisplayName("AC2: an owner turn-limit change is read fresh and takes effect immediately")
    void turnLimitIsDynamicAndBounded() {
        assertThat(settings.conversationTurnLimit()).isEqualTo(40);

        put("ai_assistant_conversation_turn_limit", "64");
        assertThat(settings.conversationTurnLimit()).isEqualTo(64);

        put("ai_assistant_conversation_turn_limit", "999");
        assertThat(settings.conversationTurnLimit()).isEqualTo(100);
        put("ai_assistant_conversation_turn_limit", "invalid");
        assertThat(settings.conversationTurnLimit()).isEqualTo(40);
    }

    @Test
    @DisplayName("AC9 VI/EN: outside hours fail closed and show the configured weekly schedule")
    void businessHoursAreBilingualAndNeverPromiseAnUnavailableStaffMember() {
        put("ai_assistant_business_hours", """
                {"timezone":"Asia/Ho_Chi_Minh","days":{
                  "MON":{"enabled":true,"open":"09:00","close":"17:00"},
                  "TUE":{"enabled":false,"open":"09:00","close":"17:00"},
                  "WED":{"enabled":false,"open":"09:00","close":"17:00"},
                  "THU":{"enabled":false,"open":"09:00","close":"17:00"},
                  "FRI":{"enabled":false,"open":"09:00","close":"17:00"},
                  "SAT":{"enabled":false,"open":"09:00","close":"17:00"},
                  "SUN":{"enabled":false,"open":"09:00","close":"17:00"}}}
                """);
        Instant mondayAfterClose = Instant.parse("2026-08-24T12:30:00Z"); // 19:30 VN

        var vi = settings.businessHours(mondayAfterClose, "vi");
        var en = settings.businessHours(mondayAfterClose, "en");

        assertThat(vi.withinHours()).isFalse();
        assertThat(vi.scheduleText()).contains("T2 09:00–17:00", "T3 nghỉ");
        assertThat(en.withinHours()).isFalse();
        assertThat(en.scheduleText()).contains("Mon 09:00–17:00", "Tue closed", "Vietnam time");
    }

    @Test
    @DisplayName("AC20: proactive chat is off by default and thresholds are owner-adjustable")
    void proactiveDefaultsOffAndReadsFreshThresholds() {
        assertThat(settings.proactive()).isEqualTo(new ChatPhase3Settings.Proactive(false, 45, 120));

        put("ai_assistant_proactive_enabled", "true");
        put("ai_assistant_proactive_product_seconds", "75");
        put("ai_assistant_proactive_cart_seconds", "180");

        assertThat(settings.proactive()).isEqualTo(new ChatPhase3Settings.Proactive(true, 75, 180));
    }

    private void put(String key, String value) {
        SiteSettingEntity setting = new SiteSettingEntity();
        setting.setSettingKey(key);
        setting.setSettingValue(value);
        values.put(key, setting);
    }
}
