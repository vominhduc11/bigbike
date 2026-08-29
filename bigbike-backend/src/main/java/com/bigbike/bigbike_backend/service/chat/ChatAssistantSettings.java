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
import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Customer-visible settings retained after the 2026-08-29 assistant simplification.
 *
 * <p>The Gemini model, image quotas, memory duration and natural-language shorthand are
 * deliberately code/server configuration, not owner-editable site settings.</p>
 */
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
    public static final String KEY_IMAGE_ENABLED = "ai_assistant_image_enabled";
    public static final String SETTING_GROUP = "ai_assistant";

    public static final int DEFAULT_DAILY_LIMIT = 400;
    public static final int DEFAULT_RECENT_TURN_PAIRS = 12;
    /** Image reading stays bounded, but its quotas are not admin settings. */
    public static final int IMAGE_DAILY_LIMIT = 20;
    public static final int IMAGE_CONVERSATION_LIMIT = 3;

    private static final String DEFAULT_GREETING_VI =
            "Em là Trợ lý BigBike, trợ lý ảo AI của BigBike. Em có thể giúp anh/chị chọn sản phẩm, xem chính sách hoặc kiểm tra đơn hàng khi đã đăng nhập.";
    private static final String DEFAULT_GREETING_EN =
            "I’m BigBike Assistant, BigBike’s AI shopping assistant. I can help you choose products, check store policies, or view orders on your signed-in account.";

    private static final List<String> DEFAULT_PROMPTS_VI = List.of(
            "Mũ bảo hiểm nào dưới 2 triệu phù hợp đi phố?",
            "Mũ bảo hiểm nào từ 2 đến 5 triệu đáng cân nhắc?",
            "Hướng dẫn tôi chọn size phù hợp.",
            "Chính sách đổi trả của BigBike như thế nào?");
    private static final List<String> DEFAULT_PROMPTS_EN = List.of(
            "Which helmets under VND 2 million suit city riding?",
            "Which helmets from VND 2 to 5 million should I consider?",
            "Help me choose the right size.",
            "What is BigBike's return policy?");

    private final SiteSettingJpaRepository settingRepo;

    @Transactional(readOnly = true)
    public ImageSettings imageSettings() {
        Map<String, SiteSettingEntity> settings = settingsByKey();
        return new ImageSettings(
                readBoolean(settings, KEY_IMAGE_ENABLED, false),
                IMAGE_DAILY_LIMIT,
                IMAGE_CONVERSATION_LIMIT);
    }

    public static String defaultGreeting(String lang) {
        return "en".equals(lang) ? DEFAULT_GREETING_EN : DEFAULT_GREETING_VI;
    }

    public static List<String> defaultQuickPrompts(String lang) {
        return "en".equals(lang) ? DEFAULT_PROMPTS_EN : DEFAULT_PROMPTS_VI;
    }

    @Transactional(readOnly = true)
    public Snapshot load(String lang) {
        Map<String, SiteSettingEntity> settings = settingsByKey();
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
                Math.min(12, readInteger(settings, KEY_RECENT_TURN_PAIRS, DEFAULT_RECENT_TURN_PAIRS)),
                new BankDetails(
                        value(settings, "bank_name"),
                        value(settings, "bank_account_number"),
                        value(settings, "bank_account_holder"),
                        value(settings, "bank_branch")),
                policy(settings, "policy_warranty_title", "policy_warranty_body_html", english),
                policy(settings, "policy_return_exchange_title",
                        "policy_return_exchange_body_html", english));
    }

    private Map<String, SiteSettingEntity> settingsByKey() {
        return settingRepo.findAll().stream().collect(Collectors.toMap(
                SiteSettingEntity::getSettingKey, Function.identity(), (first, ignored) -> first));
    }

    private static List<String> prompts(String raw, boolean english) {
        List<String> parsed = Arrays.stream(raw.split("\\R"))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .limit(4)
                .toList();
        return parsed.size() >= 3 ? parsed : defaultQuickPrompts(english ? "en" : "vi");
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
        String candidate = english ? setting.getSettingValueEn() : setting.getSettingValue();
        return candidate == null || candidate.isBlank() ? fallback : candidate.trim();
    }

    private static String value(Map<String, SiteSettingEntity> settings, String key) {
        SiteSettingEntity setting = settings.get(key);
        return setting == null || setting.getSettingValue() == null
                ? "" : setting.getSettingValue().trim();
    }

    private static PolicyText policy(
            Map<String, SiteSettingEntity> settings,
            String titleKey,
            String bodyKey,
            boolean english
    ) {
        String title = localized(settings, titleKey, english, "");
        String html = localized(settings, bodyKey, english, "");
        String text = html.isBlank() ? "" : Jsoup.parseBodyFragment(html).text().trim();
        return new PolicyText(title, text);
    }

    public record ImageSettings(boolean enabled, int dailyLimit, int conversationLimit) {}

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
            int recentTurnPairs,
            BankDetails bankDetails,
            PolicyText warrantyPolicy,
            PolicyText returnExchangePolicy
    ) {
        /** Compatibility constructor used by focused consultation tests. */
        public Snapshot(
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
            this(enabled, dailyLimit, searchAiInterpretationEnabled, greeting, quickPrompts,
                    contacts, address, openingHoursWeekday, openingHoursWeekend, recentTurnPairs,
                    BankDetails.empty(), PolicyText.empty(), PolicyText.empty());
        }

        /** Compatibility constructor for consultation tests that use the default recent-turn cap. */
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
            this(enabled, dailyLimit, searchAiInterpretationEnabled, greeting, quickPrompts,
                    contacts, address, openingHoursWeekday, openingHoursWeekend,
                    DEFAULT_RECENT_TURN_PAIRS,
                    BankDetails.empty(), PolicyText.empty(), PolicyText.empty());
        }

        /** Compatibility constructor used by older consultation tests. */
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
            this(enabled, dailyLimit, true, greeting, quickPrompts, contacts, address,
                    openingHoursWeekday, openingHoursWeekend, 0,
                    BankDetails.empty(), PolicyText.empty(), PolicyText.empty());
        }

        public Snapshot {
            quickPrompts = quickPrompts == null ? List.of() : List.copyOf(quickPrompts);
            recentTurnPairs = Math.max(0, Math.min(12, recentTurnPairs));
            bankDetails = bankDetails == null ? BankDetails.empty() : bankDetails;
            warrantyPolicy = warrantyPolicy == null ? PolicyText.empty() : warrantyPolicy;
            returnExchangePolicy = returnExchangePolicy == null
                    ? PolicyText.empty() : returnExchangePolicy;
        }
    }

    public record BankDetails(String bankName, String accountNumber, String accountHolder, String branch) {
        public static BankDetails empty() {
            return new BankDetails("", "", "", "");
        }

        public boolean complete() {
            return bankName != null && !bankName.isBlank()
                    && accountNumber != null && !accountNumber.isBlank()
                    && accountHolder != null && !accountHolder.isBlank()
                    && branch != null && !branch.isBlank();
        }
    }

    public record PolicyText(String title, String text) {
        public static PolicyText empty() {
            return new PolicyText("", "");
        }

        public boolean available() {
            return text != null && !text.isBlank();
        }
    }
}
