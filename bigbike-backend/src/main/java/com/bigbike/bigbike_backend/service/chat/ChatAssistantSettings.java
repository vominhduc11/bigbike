package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class ChatAssistantSettings {

    public static final String KEY_ENABLED = "ai_assistant_enabled";
    public static final String KEY_DAILY_LIMIT = "ai_assistant_daily_limit";
    public static final String KEY_RECENT_TURN_PAIRS = "ai_assistant_recent_turn_pairs";
    public static final String KEY_SEARCH_AI_INTERPRETATION_ENABLED =
            "ai_assistant_search_ai_interpretation_enabled";
    public static final String KEY_GREETING = "ai_assistant_greeting";
    public static final String KEY_QUICK_PROMPTS = "ai_assistant_quick_prompts";
    public static final String SETTING_GROUP = "ai_assistant";
    public static final int DEFAULT_DAILY_LIMIT = 60;
    public static final int DEFAULT_RECENT_TURN_PAIRS = 3;

    private static final String DEFAULT_GREETING_VI =
            "Em là Trợ lý BigBike, trợ lý ảo AI của BigBike. Em có thể giúp anh/chị chọn sản phẩm, xem chính sách hoặc kiểm tra đơn hàng khi đã đăng nhập.";
    private static final String DEFAULT_GREETING_EN =
            "I’m BigBike Assistant, BigBike’s AI shopping assistant. I can help you choose products, check store policies, or view orders on your signed-in account.";

    private static final List<String> DEFAULT_PROMPTS_VI = List.of(
            "Mũ bảo hiểm dưới 2 triệu",
            "Mũ bảo hiểm từ 2 đến 5 triệu",
            "Tư vấn chọn size",
            "Chính sách đổi trả");
    private static final List<String> DEFAULT_PROMPTS_EN = List.of(
            "Helmets under 2 million VND",
            "Helmets from 2 to 5 million VND",
            "Help me choose a size",
            "Return policy");

    private final SiteSettingJpaRepository settingRepo;

    public static String defaultGreeting(String lang) {
        return "en".equals(lang) ? DEFAULT_GREETING_EN : DEFAULT_GREETING_VI;
    }

    public static List<String> defaultQuickPrompts(String lang) {
        return "en".equals(lang) ? DEFAULT_PROMPTS_EN : DEFAULT_PROMPTS_VI;
    }

    @Transactional(readOnly = true)
    public Snapshot load(String lang) {
        Map<String, SiteSettingEntity> settings = settingRepo.findAll().stream()
                .collect(Collectors.toMap(SiteSettingEntity::getSettingKey, Function.identity()));
        boolean english = "en".equals(lang);
        return new Snapshot(
                readBoolean(settings, KEY_ENABLED, true),
                readInteger(settings, KEY_DAILY_LIMIT, DEFAULT_DAILY_LIMIT),
                readBoolean(settings, KEY_SEARCH_AI_INTERPRETATION_ENABLED, true),
                localized(settings, KEY_GREETING, english, defaultGreeting(lang)),
                prompts(localized(settings, KEY_QUICK_PROMPTS, english, ""), english),
                new ChatContactResponse(
                        value(settings, "hotline"),
                        value(settings, "zalo_url"),
                        value(settings, "messenger_url"),
                        value(settings, "zalo_display"),
                        value(settings, "messenger_display")),
                localized(settings, "contact_address", english, ""),
                localized(settings, "opening_hours_weekday", english, ""),
                localized(settings, "opening_hours_weekend", english, ""),
                Math.min(3, readInteger(
                        settings, KEY_RECENT_TURN_PAIRS, DEFAULT_RECENT_TURN_PAIRS)));
    }

    private static List<String> prompts(String raw, boolean english) {
        List<String> parsed = Arrays.stream(raw.split("\\R"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .limit(4)
                .toList();
        return parsed.size() >= 3
                ? parsed
                : defaultQuickPrompts(english ? "en" : "vi");
    }

    private static boolean readBoolean(
            Map<String, SiteSettingEntity> settings, String key, boolean fallback) {
        String raw = value(settings, key);
        return raw.isEmpty() ? fallback : "true".equalsIgnoreCase(raw);
    }

    private static int readInteger(
            Map<String, SiteSettingEntity> settings, String key, int fallback) {
        try {
            int parsed = Integer.parseInt(value(settings, key));
            return parsed < 0 ? fallback : parsed;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static String localized(
            Map<String, SiteSettingEntity> settings,
            String key,
            boolean english,
            String fallback
    ) {
        SiteSettingEntity setting = settings.get(key);
        if (setting == null) return fallback;
        // English widget copy must remain English. A Vietnamese fallback would leak mixed
        // language into the customer UI when an admin has not supplied the EN value yet.
        String candidate = english ? setting.getSettingValueEn() : setting.getSettingValue();
        return candidate == null || candidate.isBlank() ? fallback : candidate.trim();
    }

    private static String value(Map<String, SiteSettingEntity> settings, String key) {
        SiteSettingEntity setting = settings.get(key);
        return setting == null || setting.getSettingValue() == null
                ? "" : setting.getSettingValue().trim();
    }

    public record Snapshot(
            boolean enabled,
            int dailyLimit,
            boolean searchAiInterpretationEnabled,
            String greeting,
            List<String> quickPrompts,
            ChatContactResponse contacts,
            String address,
            String openingHoursWeekday,
            String openingHoursWeekend,
            int recentTurnPairs
    ) {
        public Snapshot(
                boolean enabled,
                int dailyLimit,
                boolean searchAiInterpretationEnabled,
                String greeting,
                List<String> quickPrompts,
                ChatContactResponse contacts,
                String address,
                String openingHoursWeekday,
                String openingHoursWeekend
        ) {
            this(
                    enabled,
                    dailyLimit,
                    searchAiInterpretationEnabled,
                    greeting,
                    quickPrompts,
                    contacts,
                    address,
                    openingHoursWeekday,
                    openingHoursWeekend,
                    0);
        }

        public Snapshot(
                boolean enabled,
                int dailyLimit,
                String greeting,
                List<String> quickPrompts,
                ChatContactResponse contacts,
                String address,
                String openingHoursWeekday,
                String openingHoursWeekend
        ) {
            this(
                    enabled,
                    dailyLimit,
                    true,
                    greeting,
                    quickPrompts,
                    contacts,
                    address,
                    openingHoursWeekday,
                    openingHoursWeekend,
                    0);
        }

        public Snapshot {
            quickPrompts = List.copyOf(quickPrompts);
            recentTurnPairs = Math.max(0, Math.min(3, recentTurnPairs));
        }
    }
}
