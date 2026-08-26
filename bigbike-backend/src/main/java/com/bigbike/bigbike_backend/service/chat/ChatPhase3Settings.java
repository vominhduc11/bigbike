package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import com.bigbike.bigbike_backend.persistence.repository.settings.SiteSettingJpaRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.StringJoiner;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Phase-3 operational settings that must be read fresh for every customer action. */
@Component
@RequiredArgsConstructor
public class ChatPhase3Settings {

    public static final int DEFAULT_TURN_LIMIT = 40;
    public static final int DEFAULT_MEMORY_DAYS = 30;
    public static final int DEFAULT_PRODUCT_SECONDS = 45;
    public static final int DEFAULT_CART_SECONDS = 120;
    public static final ZoneId SHOP_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");

    private final SiteSettingJpaRepository settingRepo;
    private final ObjectMapper mapper = new ObjectMapper();

    @Transactional(readOnly = true)
    public int conversationTurnLimit() {
        return rangedInteger("ai_assistant_conversation_turn_limit", DEFAULT_TURN_LIMIT, 10, 100);
    }

    @Transactional(readOnly = true)
    public int memoryDays() {
        return rangedInteger("ai_assistant_memory_days", DEFAULT_MEMORY_DAYS, 1, 30);
    }

    @Transactional(readOnly = true)
    public Proactive proactive() {
        return new Proactive(
                booleanValue("ai_assistant_proactive_enabled", false),
                rangedInteger("ai_assistant_proactive_product_seconds", DEFAULT_PRODUCT_SECONDS, 15, 600),
                rangedInteger("ai_assistant_proactive_cart_seconds", DEFAULT_CART_SECONDS, 15, 600));
    }

    @Transactional(readOnly = true)
    public BusinessHoursStatus businessHours(Instant now, String lang) {
        Map<String, Object> root = readSchedule();
        if (root == null) return closedFallback(now, lang);
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> days = (Map<String, Object>) root.get("days");
            if (days == null) return closedFallback(now, lang);
            ZonedDateTime localNow = now.atZone(SHOP_ZONE);
            DayWindow today = window(days, localNow.getDayOfWeek());
            if (today.enabled()
                    && !localNow.toLocalTime().isBefore(today.open())
                    && localNow.toLocalTime().isBefore(today.close())) {
                return new BusinessHoursStatus(true, null, scheduleText(days, lang));
            }
            for (int offset = 0; offset <= 7; offset++) {
                LocalDate date = localNow.toLocalDate().plusDays(offset);
                DayWindow candidate = window(days, date.getDayOfWeek());
                if (!candidate.enabled()) continue;
                ZonedDateTime opening = date.atTime(candidate.open()).atZone(SHOP_ZONE);
                if (opening.toInstant().isAfter(now)) {
                    return new BusinessHoursStatus(false, opening.toInstant(), scheduleText(days, lang));
                }
            }
            return closedFallback(now, lang);
        } catch (RuntimeException exception) {
            return closedFallback(now, lang);
        }
    }

    private Map<String, Object> readSchedule() {
        String raw = value("ai_assistant_business_hours");
        if (raw == null || raw.isBlank()) return defaultSchedule();
        try {
            return mapper.readValue(raw, new TypeReference<>() {});
        } catch (Exception exception) {
            return null;
        }
    }

    private static DayWindow window(Map<String, Object> days, DayOfWeek day) {
        Object raw = days.get(day.name().substring(0, 3));
        if (!(raw instanceof Map<?, ?> values)) return DayWindow.closed();
        Object enabled = values.get("enabled");
        if (!(enabled instanceof Boolean active) || !active) return DayWindow.closed();
        Object open = values.get("open");
        Object close = values.get("close");
        if (!(open instanceof String openText) || !(close instanceof String closeText)) {
            return DayWindow.closed();
        }
        LocalTime opening = LocalTime.parse(openText, TIME);
        LocalTime closing = LocalTime.parse(closeText, TIME);
        if (!closing.isAfter(opening)) return DayWindow.closed();
        return new DayWindow(true, opening, closing);
    }

    private static String scheduleText(Map<String, Object> days, String lang) {
        boolean english = "en".equals(lang);
        DayOfWeek[] orderedDays = {
            DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
            DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY
        };
        String[] labels = english
                ? new String[] {"Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"}
                : new String[] {"T2", "T3", "T4", "T5", "T6", "T7", "CN"};
        boolean anyEnabled = false;
        StringJoiner result = new StringJoiner(" · ");
        for (int index = 0; index < orderedDays.length; index++) {
            DayWindow current = window(days, orderedDays[index]);
            anyEnabled |= current.enabled();
            result.add(labels[index] + " " + (current.enabled()
                    ? TIME.format(current.open()) + "–" + TIME.format(current.close())
                    : (english ? "closed" : "nghỉ")));
        }
        if (!anyEnabled) {
            return english ? "Staff hours are being updated." : "Giờ trực nhân viên đang được cập nhật.";
        }
        return result + (english ? " (Vietnam time)" : "");
    }

    private BusinessHoursStatus closedFallback(Instant now, String lang) {
        // Invalid schedules fail closed and never promise that somebody is currently available.
        return new BusinessHoursStatus(
                false,
                null,
                "en".equals(lang)
                        ? "Staff hours are being updated. Please leave your contact details."
                        : "Giờ trực nhân viên đang được cập nhật. Anh/chị vui lòng để lại liên hệ.");
    }

    private int rangedInteger(String key, int fallback, int min, int max) {
        try {
            int parsed = Integer.parseInt(value(key));
            return Math.max(min, Math.min(max, parsed));
        } catch (RuntimeException exception) {
            return fallback;
        }
    }

    private boolean booleanValue(String key, boolean fallback) {
        String raw = value(key);
        return raw == null || raw.isBlank() ? fallback : Boolean.parseBoolean(raw);
    }

    private String value(String key) {
        return settingRepo.findBySettingKey(key).map(SiteSettingEntity::getSettingValue).orElse("");
    }

    private static Map<String, Object> defaultSchedule() {
        Map<String, Object> weekday = Map.of("enabled", true, "open", "09:00", "close", "21:00");
        Map<String, Object> weekend = Map.of("enabled", true, "open", "09:00", "close", "18:00");
        return Map.of("timezone", SHOP_ZONE.getId(), "days", Map.of(
                "MON", weekday, "TUE", weekday, "WED", weekday, "THU", weekday, "FRI", weekday,
                "SAT", weekend, "SUN", weekend));
    }

    public record Proactive(boolean enabled, int productSeconds, int cartSeconds) {}
    public record BusinessHoursStatus(boolean withinHours, Instant nextOpenAt, String scheduleText) {}
    private record DayWindow(boolean enabled, LocalTime open, LocalTime close) {
        static DayWindow closed() { return new DayWindow(false, LocalTime.MIDNIGHT, LocalTime.MIDNIGHT); }
    }
}
