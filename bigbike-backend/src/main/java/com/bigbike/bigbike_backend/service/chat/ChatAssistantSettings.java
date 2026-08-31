package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Customer-visible assistant settings that remain owner-editable. */
@Component
@RequiredArgsConstructor
public class ChatAssistantSettings {

    public static final String KEY_ENABLED = "ai_assistant_enabled";
    public static final String KEY_DAILY_LIMIT = "ai_assistant_daily_limit";
    public static final String KEY_RECENT_TURN_PAIRS = "ai_assistant_recent_turn_pairs";
    public static final String KEY_SEARCH_AI_INTERPRETATION_ENABLED =
            "ai_assistant_search_ai_interpretation_enabled";
    public static final String SETTING_GROUP = "ai_assistant";

    public static final int DEFAULT_DAILY_LIMIT = 400;
    public static final int DEFAULT_RECENT_TURN_PAIRS = 12;
    public static final int DEFAULT_TURN_LIMIT = 40;
    public static final int DEFAULT_MEMORY_DAYS = 30;
    public static final int IMAGE_DAILY_LIMIT = 20;
    public static final int IMAGE_CONVERSATION_LIMIT = 3;

    private final SiteSettingJpaRepository settingRepo;

    /** Image quotas are software policy, not settings. Availability is checked by the AI client. */
    public ImageSettings imageSettings() {
        return new ImageSettings(true, IMAGE_DAILY_LIMIT, IMAGE_CONVERSATION_LIMIT);
    }

    @Transactional(readOnly = true)
    public Snapshot load(String lang) {
        Map<String, SiteSettingEntity> settings = settingsByKey();
        boolean english = "en".equals(lang);
        return new Snapshot(
                readBoolean(settings, KEY_ENABLED, true),
                readInteger(settings, KEY_DAILY_LIMIT, DEFAULT_DAILY_LIMIT),
                readBoolean(settings, KEY_SEARCH_AI_INTERPRETATION_ENABLED, true),
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
            ChatContactResponse contacts,
            String address,
            String openingHoursWeekday,
            String openingHoursWeekend,
            int recentTurnPairs,
            BankDetails bankDetails,
            PolicyText warrantyPolicy,
            PolicyText returnExchangePolicy
    ) {
        public Snapshot {
            contacts = contacts == null ? new ChatContactResponse("", "", "", "", "") : contacts;
            address = address == null ? "" : address;
            openingHoursWeekday = openingHoursWeekday == null ? "" : openingHoursWeekday;
            openingHoursWeekend = openingHoursWeekend == null ? "" : openingHoursWeekend;
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
