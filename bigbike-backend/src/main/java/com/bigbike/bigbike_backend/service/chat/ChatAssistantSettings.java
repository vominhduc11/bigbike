package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.api.chat.dto.ChatContactResponse;
import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import java.util.Arrays;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class ChatAssistantSettings {

    public static final String KEY_ENABLED = "ai_assistant_enabled";
    public static final String KEY_DAILY_LIMIT = "ai_assistant_daily_limit";
    public static final String KEY_MONTHLY_COST_WARNING_USD = "ai_assistant_monthly_cost_warning_usd";
    public static final String KEY_RECENT_TURN_PAIRS = "ai_assistant_recent_turn_pairs";
    public static final String KEY_SEARCH_AI_INTERPRETATION_ENABLED =
            "ai_assistant_search_ai_interpretation_enabled";
    public static final String KEY_GREETING = "ai_assistant_greeting";
    public static final String KEY_QUICK_PROMPTS = "ai_assistant_quick_prompts";
    public static final String KEY_ABBREVIATIONS = "ai_assistant_abbreviations";
    public static final String KEY_ANSWER_TEMPLATES = "ai_assistant_answer_templates";
    public static final String SETTING_GROUP = "ai_assistant";
    public static final int DEFAULT_DAILY_LIMIT = 400;
    public static final int DEFAULT_RECENT_TURN_PAIRS = 12;

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
    private final ObjectMapper objectMapper = new ObjectMapper();

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
                Math.min(12, readInteger(
                        settings, KEY_RECENT_TURN_PAIRS, DEFAULT_RECENT_TURN_PAIRS)),
                readDecimal(settings, KEY_MONTHLY_COST_WARNING_USD, BigDecimal.ZERO),
                readAbbreviations(settings),
                readAnswerTemplates(settings));
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

    private static BigDecimal readDecimal(
            Map<String, SiteSettingEntity> settings, String key, BigDecimal fallback) {
        try {
            BigDecimal parsed = new BigDecimal(value(settings, key));
            return parsed.signum() < 0 ? fallback : parsed;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private List<Abbreviation> readAbbreviations(Map<String, SiteSettingEntity> settings) {
        String raw = value(settings, KEY_ABBREVIATIONS);
        if (raw.isBlank()) return defaultAbbreviations();
        try {
            List<Abbreviation> values = objectMapper.readValue(raw, new TypeReference<>() {});
            return values == null ? defaultAbbreviations() : values.stream()
                    .filter(java.util.Objects::nonNull)
                    .limit(100)
                    .toList();
        } catch (Exception ignored) {
            return defaultAbbreviations();
        }
    }

    private List<AnswerTemplate> readAnswerTemplates(Map<String, SiteSettingEntity> settings) {
        String raw = value(settings, KEY_ANSWER_TEMPLATES);
        if (raw.isBlank()) return List.of();
        try {
            List<AnswerTemplate> values = objectMapper.readValue(raw, new TypeReference<>() {});
            return values == null ? List.of() : values.stream()
                    .filter(java.util.Objects::nonNull)
                    .limit(50)
                    .toList();
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private static List<Abbreviation> defaultAbbreviations() {
        Map<String, String> values = new LinkedHashMap<>();
        values.put("mu bh", "mu bao hiem");
        values.put("mbh", "mu bao hiem");
        values.put("non", "mu bao hiem");
        values.put("kieng", "kinh");
        values.put("mu ff", "mu fullface");
        values.put("tn", "tai nghe");
        values.put("bh", "bao hanh");
        values.put("sdt", "so dien thoai");
        values.put("cty", "cong ty");
        values.put("ship", "giao hang");
        values.put("sz", "size");
        values.put("bnhieu", "bao nhieu");
        values.put("bn", "bao nhieu");
        values.put("hok", "khong");
        values.put("khong", "khong");
        values.put("ko", "khong");
        values.put("ntn", "nhu the nao");
        values.put("dc", "duoc");
        values.put("ae", "anh em");
        values.put("ad", "admin");
        values.put("z", "vay");
        values.put("j", "gi");
        return values.entrySet().stream()
                .map(entry -> new Abbreviation("vi", entry.getKey(), entry.getValue(), true))
                .toList();
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
            int recentTurnPairs,
            BigDecimal monthlyCostWarningUsd,
            List<Abbreviation> abbreviations,
            List<AnswerTemplate> answerTemplates
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
                String openingHoursWeekend,
                int recentTurnPairs
        ) {
            this(
                    enabled, dailyLimit, searchAiInterpretationEnabled, greeting, quickPrompts,
                    contacts, address, openingHoursWeekday, openingHoursWeekend, recentTurnPairs,
                    BigDecimal.ZERO, defaultAbbreviations(), List.of());
        }

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
                    0,
                    BigDecimal.ZERO,
                    defaultAbbreviations(),
                    List.of());
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
                    0,
                    BigDecimal.ZERO,
                    defaultAbbreviations(),
                    List.of());
        }

        public Snapshot {
            quickPrompts = List.copyOf(quickPrompts);
            recentTurnPairs = Math.max(0, Math.min(12, recentTurnPairs));
            monthlyCostWarningUsd = monthlyCostWarningUsd == null || monthlyCostWarningUsd.signum() < 0
                    ? BigDecimal.ZERO : monthlyCostWarningUsd;
            abbreviations = abbreviations == null ? List.of() : List.copyOf(abbreviations);
            answerTemplates = answerTemplates == null ? List.of() : List.copyOf(answerTemplates);
        }

        public Map<String, String> abbreviationMap() {
            return abbreviationMap("vi");
        }

        public Map<String, String> abbreviationMap(String lang) {
            return abbreviations.stream()
                    .filter(Abbreviation::enabled)
                    .filter(item -> java.util.Objects.equals(
                            "en".equals(lang) ? "en" : "vi", item.locale()))
                    .filter(item -> item.phrase() != null && item.expansion() != null)
                    .sorted(Comparator.comparingInt((Abbreviation item) -> item.phrase().length()).reversed())
                    .collect(Collectors.toMap(
                            item -> ChatToolService.normalize(item.phrase()),
                            item -> ChatToolService.normalize(item.expansion()),
                            (first, ignored) -> first,
                            LinkedHashMap::new));
        }

        public Optional<String> matchAnswerTemplate(String question, String lang) {
            String normalized = ChatToolService.normalize(question == null ? "" : question);
            List<TemplateMatch> matches = new ArrayList<>();
            for (AnswerTemplate template : answerTemplates) {
                if (template == null || !template.enabled()) continue;
                List<String> triggers = "en".equals(lang) ? template.triggersEn() : template.triggersVi();
                if (triggers == null) continue;
                for (String trigger : triggers) {
                    String candidate = ChatToolService.normalize(trigger == null ? "" : trigger);
                    if (!candidate.isBlank() && containsWholePhrase(normalized, candidate)) {
                        matches.add(new TemplateMatch(candidate.length(), template));
                    }
                }
            }
            int longest = matches.stream().mapToInt(TemplateMatch::length).max().orElse(0);
            List<AnswerTemplate> winners = matches.stream()
                    .filter(match -> match.length() == longest)
                    .map(TemplateMatch::template)
                    .distinct()
                    .toList();
            if (winners.size() != 1) return Optional.empty();
            String answer = "en".equals(lang) ? winners.get(0).answerEn() : winners.get(0).answerVi();
            return answer == null || answer.isBlank() ? Optional.empty() : Optional.of(answer.trim());
        }
    }

    private static boolean containsWholePhrase(String value, String phrase) {
        return (" " + value + " ").contains(" " + phrase + " ");
    }

    public record Abbreviation(String locale, String phrase, String expansion, boolean enabled) {}

    public record AnswerTemplate(
            String id,
            String topic,
            boolean enabled,
            List<String> triggersVi,
            List<String> triggersEn,
            String answerVi,
            String answerEn
    ) {}

    private record TemplateMatch(int length, AnswerTemplate template) {}
}
