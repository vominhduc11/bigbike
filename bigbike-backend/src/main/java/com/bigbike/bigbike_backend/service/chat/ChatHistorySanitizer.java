package com.bigbike.bigbike_backend.service.chat;

import com.bigbike.bigbike_backend.persistence.entity.chat.ChatMessageEntity;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/** Builds the bounded, PII-redacted RECENT_TURNS payload required by CHAT_RULE_005. */
public final class ChatHistorySanitizer {

    static final int MAX_MESSAGE_CHARS = 450;

    private static final Pattern EMAIL = Pattern.compile(
            "(?iu)(?<![\\p{Alnum}._%+-])[\\p{Alnum}._%+-]+@[\\p{Alnum}.-]+\\.[a-z]{2,}(?![\\p{Alnum}])");
    private static final Pattern PHONE = Pattern.compile(
            "(?<![\\p{Alnum}])(?:\\+?84|0)(?:[ .()\\-]*\\d){8,10}(?!\\d)");
    private static final Pattern BIGBIKE_ORDER = Pattern.compile(
            "(?iu)(?<![\\p{Alnum}])BB-\\d{8}-[A-Z0-9]{6}(?![\\p{Alnum}])");
    private static final Pattern LABELED_ORDER = Pattern.compile(
            "(?iu)(?:mã|ma)?\\s*(?:đơn|don|order)(?:\\s*(?:hàng|hang|number|no\\.?))?"
                    + "\\s*[:#-]\\s*[A-Z0-9][A-Z0-9-]{4,}");
    private static final Pattern LABELED_ADDRESS = Pattern.compile(
            "(?iu)(?:địa\\s*chỉ|dia\\s*chi|address)\\s*[:=-]?\\s*[^.!?\\r\\n]{3,180}");
    private static final Pattern STREET_ADDRESS = Pattern.compile(
            "(?iu)(?:giao|ship|gửi|gui)\\s+(?:đến|den|tới|toi|về|ve)\\s+"
                    + "(?:số|so)?\\s*\\d{1,5}[A-Z]?(?:[/.-]\\d{1,5})?\\s+"
                    + "[^.!?\\r\\n]{2,120}");
    private static final Pattern GENERIC_STREET_ADDRESS = Pattern.compile(
            "(?iu)(?<![\\p{Alnum}])(?:số|so)?\\s*\\d{1,5}[A-Z]?(?:[/.-]\\d{1,5})?\\s+"
                    + "(?:(?:đường|duong|phố|pho|street|road)\\s+[^.!?\\r\\n]{2,120}"
                    + "|[^.!?\\r\\n]{2,80}\\b(?:phường|phuong|quận|quan|"
                    + "thành phố|thanh pho|ward|district)\\b[^.!?\\r\\n]{0,60})");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private ChatHistorySanitizer() {
    }

    public static List<RecentTurn> recentTurns(
            List<ChatMessageEntity> messages,
            int requestedPairs
    ) {
        int limit = Math.max(0, Math.min(3, requestedPairs));
        if (limit == 0 || messages == null || messages.isEmpty()) return List.of();

        List<RecentTurn> completed = new ArrayList<>();
        String customer = null;
        for (ChatMessageEntity message : messages) {
            if (message == null || message.getContent() == null) continue;
            if ("CUSTOMER".equals(message.getRole())) {
                customer = sanitize(message.getContent());
            } else if ("ASSISTANT".equals(message.getRole()) && customer != null) {
                completed.add(new RecentTurn(customer, sanitize(message.getContent())));
                customer = null;
            }
        }
        int from = Math.max(0, completed.size() - limit);
        return List.copyOf(completed.subList(from, completed.size()));
    }

    public static String sanitize(String value) {
        if (value == null || value.isBlank()) return "";
        String redacted = LABELED_ADDRESS.matcher(value).replaceAll("[ĐỊA CHỈ ĐÃ CHE]");
        redacted = STREET_ADDRESS.matcher(redacted).replaceAll("[ĐỊA CHỈ ĐÃ CHE]");
        redacted = GENERIC_STREET_ADDRESS.matcher(redacted).replaceAll("[ĐỊA CHỈ ĐÃ CHE]");
        redacted = EMAIL.matcher(redacted).replaceAll("[EMAIL ĐÃ CHE]");
        redacted = PHONE.matcher(redacted).replaceAll("[SỐ ĐIỆN THOẠI ĐÃ CHE]");
        redacted = BIGBIKE_ORDER.matcher(redacted).replaceAll("[MÃ ĐƠN ĐÃ CHE]");
        redacted = LABELED_ORDER.matcher(redacted).replaceAll("[MÃ ĐƠN ĐÃ CHE]");
        String compact = WHITESPACE.matcher(redacted).replaceAll(" ").trim();
        return compact.length() <= MAX_MESSAGE_CHARS
                ? compact
                : compact.substring(0, MAX_MESSAGE_CHARS).trim();
    }

    public record RecentTurn(String customer, String assistant) {
    }
}
