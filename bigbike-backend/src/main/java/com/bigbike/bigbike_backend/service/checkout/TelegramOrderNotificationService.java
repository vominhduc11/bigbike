package com.bigbike.bigbike_backend.service.checkout;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URI;
import java.text.NumberFormat;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

/** Sends optional new-order alerts to one configured Telegram chat. */
@Service
@Slf4j
public class TelegramOrderNotificationService {

    private static final String DEFAULT_API_BASE_URL = "https://api.telegram.org";
    private static final long DEFAULT_TIMEOUT_SECONDS = 5L;
    private static final int MAX_MESSAGE_CHARS = 4096;
    private static final int MAX_DISPLAY_NAME_CHARS = 160;
    private static final int MAX_EMAIL_CHARS = 255;
    private static final int MAX_PRODUCT_NAME_CHARS = 180;
    private static final int MAX_VARIANT_NAME_CHARS = 100;
    private static final ObjectMapper JSON = new ObjectMapper();

    private final String botToken;
    private final String chatId;
    private final String apiBaseUrl;
    private final String adminBaseUrl;
    private final RestClient restClient;

    @Autowired
    public TelegramOrderNotificationService(
            @Value("${bigbike.telegram.bot-token:}") String botToken,
            @Value("${bigbike.telegram.chat-id:}") String chatId,
            @Value("${bigbike.telegram.api-base-url:}") String apiBaseUrl,
            @Value("${bigbike.telegram.timeout-seconds:5}") long timeoutSeconds,
            @Value("${bigbike.admin.base-url:https://admin.bigbike.vn}") String adminBaseUrl
    ) {
        this(botToken, chatId, apiBaseUrl, timeoutSeconds, adminBaseUrl, buildRestClient(timeoutSeconds));
    }

    TelegramOrderNotificationService(
            String botToken,
            String chatId,
            String apiBaseUrl,
            long timeoutSeconds,
            String adminBaseUrl,
            RestClient restClient
    ) {
        this.botToken = trimToEmpty(botToken);
        this.chatId = trimToEmpty(chatId);
        this.apiBaseUrl = normalizeBaseUrl(apiBaseUrl);
        this.adminBaseUrl = stripTrailingSlash(trimToEmpty(adminBaseUrl));
        this.restClient = restClient;
    }

    public boolean isConfigured() {
        return !botToken.isBlank() && !chatId.isBlank();
    }

    /**
     * Runs away from the checkout request thread. The caller invokes this only after commit and
     * catches task-submission failures separately so an overloaded executor cannot change the
     * already-created order response.
     */
    @Async
    public void sendNewOrderNotification(TelegramOrderSnapshot snapshot) {
        if (!isConfigured()) {
            return;
        }
        try {
            sendNow(snapshot);
        } catch (RuntimeException exception) {
            log.warn(
                    "Telegram new-order notification failed for order {} ({})",
                    safeOrderNumber(snapshot),
                    failureCategory(exception));
        }
    }

    /** Synchronous transport hook used by unit tests; production calls the async method above. */
    void sendNow(TelegramOrderSnapshot snapshot) {
        if (!isConfigured()) {
            return;
        }
        if (snapshot == null) {
            throw new TelegramSendException("invalid_payload");
        }

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("chat_id", chatId);
        request.put("text", formatMessage(snapshot));
        request.put("parse_mode", "HTML");
        request.put("disable_web_page_preview", true);

        String response = restClient.post()
                .uri(URI.create(apiBaseUrl + "/bot" + botToken + "/sendMessage"))
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(String.class);

        if (!isAccepted(response)) {
            throw new TelegramSendException("provider_rejected");
        }
    }

    String formatMessage(TelegramOrderSnapshot snapshot) {
        StringBuilder message = new StringBuilder(1200);
        message.append("<b>🛒 ĐƠN HÀNG MỚI</b>\n");
        message.append("<b>#")
                .append(escapeHtml(truncatePlain(snapshot.orderNumber(), 100, "—")))
                .append("</b>\n\n");

        appendLine(message, "👤 ", snapshot.customerName(), MAX_DISPLAY_NAME_CHARS, "—");
        appendCodeLine(message, "📞 ", snapshot.customerPhone(), 50, "—");
        if (!isBlank(snapshot.customerEmail())) {
            appendLine(message, "✉️ ", snapshot.customerEmail(), MAX_EMAIL_CHARS, null);
        }

        message.append("\n🧾 Sản phẩm\n");
        List<TelegramOrderSnapshot.LineItem> items = snapshot.lineItems();
        int visibleCount = Math.min(10, items.size());
        for (int index = 0; index < visibleCount; index++) {
            TelegramOrderSnapshot.LineItem item = items.get(index);
            appendProductLine(message, item);
        }
        int remaining = items.size() - visibleCount;
        if (remaining > 0) {
            message.append("… và ").append(remaining).append(" món khác\n");
        }

        message.append("\n<b>💰 Tổng: ")
                .append(escapeHtml(formatVnd(snapshot.totalAmount())))
                .append("</b>\n");
        message.append("💳 ")
                .append(escapeHtml(truncatePlain(paymentLabel(snapshot.paymentMethod()), 160, "—")))
                .append("\n");
        message.append("🌐 ")
                .append(escapeHtml(truncatePlain(sourceLabel(snapshot.source()), 100, "Đặt từ website")))
                .append("\n\n");

        if (snapshot.orderId() == null || adminBaseUrl.isBlank()) {
            message.append("👉 Mở đơn trong trang quản trị");
        } else {
            String adminOrderUrl = adminBaseUrl + "/orders/" + snapshot.orderId();
            message.append("<a href=\"")
                    .append(escapeHtml(adminOrderUrl))
                    .append("\">👉 Mở đơn trong trang quản trị</a>");
        }

        String rendered = message.toString();
        if (rendered.length() <= MAX_MESSAGE_CHARS) {
            return rendered;
        }

        // Database text fields are intentionally unbounded for legacy data. Keep the approved
        // layout but cap every variable display fragment so even pathological legacy names fit.
        return formatCompactMessage(snapshot);
    }

    private String formatCompactMessage(TelegramOrderSnapshot snapshot) {
        StringBuilder message = new StringBuilder(1000);
        message.append("<b>🛒 ĐƠN HÀNG MỚI</b>\n<b>#")
                .append(escapeHtml(truncatePlain(snapshot.orderNumber(), 80, "—")))
                .append("</b>\n\n");
        appendLine(message, "👤 ", snapshot.customerName(), 80, "—");
        appendCodeLine(message, "📞 ", snapshot.customerPhone(), 30, "—");
        if (!isBlank(snapshot.customerEmail())) {
            appendLine(message, "✉️ ", snapshot.customerEmail(), 100, null);
        }
        message.append("\n🧾 Sản phẩm\n");
        int visibleCount = Math.min(10, snapshot.lineItems().size());
        for (int index = 0; index < visibleCount; index++) {
            TelegramOrderSnapshot.LineItem item = snapshot.lineItems().get(index);
            String product = truncatePlain(normalize(item.productName(), "Sản phẩm"), 72, "Sản phẩm");
            String variant = truncatePlain(normalize(item.variantName(), ""), 36, "");
            message.append("• ").append(escapeHtml(product));
            if (!variant.isBlank()) {
                message.append(" — ").append(escapeHtml(variant));
            }
            message.append(" · x").append(Math.max(0, item.quantity()))
                    .append(" · ").append(escapeHtml(formatVnd(item.unitPrice())))
                    .append("\n");
        }
        int remaining = snapshot.lineItems().size() - visibleCount;
        if (remaining > 0) {
            message.append("… và ").append(remaining).append(" món khác\n");
        }
        message.append("\n<b>💰 Tổng: ")
                .append(escapeHtml(formatVnd(snapshot.totalAmount())))
                .append("</b>\n💳 ")
                .append(escapeHtml(truncatePlain(paymentLabel(snapshot.paymentMethod()), 100, "—")))
                .append("\n🌐 Đặt từ website\n\n");
        if (snapshot.orderId() == null || adminBaseUrl.isBlank()) {
            message.append("👉 Mở đơn trong trang quản trị");
        } else {
            String adminOrderUrl = adminBaseUrl + "/orders/" + snapshot.orderId();
            message.append("<a href=\"").append(escapeHtml(adminOrderUrl))
                    .append("\">👉 Mở đơn trong trang quản trị</a>");
        }
        return message.toString();
    }

    private static void appendProductLine(
            StringBuilder message,
            TelegramOrderSnapshot.LineItem item
    ) {
        String product = truncatePlain(normalize(item.productName(), "Sản phẩm"), MAX_PRODUCT_NAME_CHARS, "Sản phẩm");
        String variant = truncatePlain(normalize(item.variantName(), ""), MAX_VARIANT_NAME_CHARS, "");
        message.append("• ").append(escapeHtml(product));
        if (!variant.isBlank()) {
            message.append(" — ").append(escapeHtml(variant));
        }
        message.append(" · x").append(Math.max(0, item.quantity()))
                .append(" · ").append(escapeHtml(formatVnd(item.unitPrice())))
                .append("\n");
    }

    private static void appendLine(
            StringBuilder message,
            String prefix,
            String value,
            int maxChars,
            String fallback
    ) {
        String normalized = normalize(value, fallback);
        if (normalized == null) {
            return;
        }
        message.append(prefix)
                .append(escapeHtml(truncatePlain(normalized, maxChars, fallback)))
                .append("\n");
    }

    private static void appendCodeLine(
            StringBuilder message,
            String prefix,
            String value,
            int maxChars,
            String fallback
    ) {
        String normalized = normalize(value, fallback);
        if (normalized == null) {
            return;
        }
        message.append(prefix)
                .append("<code>")
                .append(escapeHtml(truncatePlain(normalized, maxChars, fallback)))
                .append("</code>\n");
    }

    private static String normalize(String value, String fallback) {
        if (isBlank(value)) {
            return fallback;
        }
        return value.replaceAll("\\s+", " ").trim();
    }

    private static String formatVnd(BigDecimal amount) {
        if (amount == null) {
            return "—";
        }
        NumberFormat formatter = NumberFormat.getNumberInstance(new Locale("vi", "VN"));
        return formatter.format(amount.setScale(0, RoundingMode.HALF_UP).toBigInteger()) + " VND";
    }

    private static String paymentLabel(String method) {
        if (isBlank(method)) {
            return "—";
        }
        return switch (method.trim().toUpperCase(Locale.ROOT)) {
            case "COD" -> "Thanh toán khi nhận hàng (COD)";
            case "BANK_TRANSFER", "BACS" -> "Chuyển khoản ngân hàng";
            default -> method.trim();
        };
    }

    private static String sourceLabel(String source) {
        if (isBlank(source) || "checkout".equalsIgnoreCase(source) || "web".equalsIgnoreCase(source)) {
            return "Đặt từ website";
        }
        return source.trim();
    }

    private static String escapeHtml(String value) {
        if (value == null) {
            return "—";
        }
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private static String truncatePlain(String value, int maxChars, String fallback) {
        String normalized = isBlank(value) ? fallback : value;
        if (normalized == null) {
            return null;
        }
        int codePoints = normalized.codePointCount(0, normalized.length());
        if (codePoints <= maxChars) {
            return normalized;
        }
        int end = normalized.offsetByCodePoints(0, Math.max(1, maxChars - 1));
        return normalized.substring(0, end) + "…";
    }

    private static boolean isAccepted(String response) {
        if (isBlank(response)) {
            return false;
        }
        try {
            JsonNode root = JSON.readTree(response);
            return root != null && root.path("ok").asBoolean(false);
        } catch (Exception ignored) {
            return false;
        }
    }

    private static RestClient buildRestClient(long timeoutSeconds) {
        long seconds = timeoutSeconds > 0 && timeoutSeconds <= Integer.MAX_VALUE / 1000L
                ? timeoutSeconds
                : DEFAULT_TIMEOUT_SECONDS;
        int timeoutMillis = (int) Duration.ofSeconds(seconds).toMillis();
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(timeoutMillis);
        factory.setReadTimeout(timeoutMillis);
        return RestClient.builder().requestFactory(factory).build();
    }

    private static String normalizeBaseUrl(String configuredUrl) {
        String trimmed = trimToEmpty(configuredUrl);
        return stripTrailingSlash(trimmed.isBlank() ? DEFAULT_API_BASE_URL : trimmed);
    }

    private static String stripTrailingSlash(String value) {
        String result = value;
        while (result.endsWith("/") && result.length() > 1) {
            result = result.substring(0, result.length() - 1);
        }
        return result;
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String safeOrderNumber(TelegramOrderSnapshot snapshot) {
        if (snapshot == null || isBlank(snapshot.orderNumber())) {
            return "—";
        }
        return snapshot.orderNumber();
    }

    private static String failureCategory(RuntimeException exception) {
        if (exception instanceof TelegramSendException telegramException) {
            return telegramException.category;
        }
        if (exception instanceof RestClientResponseException responseException) {
            return "http_" + responseException.getStatusCode().value();
        }
        if (exception instanceof ResourceAccessException) {
            return "network_or_timeout";
        }
        if (exception instanceof IllegalArgumentException) {
            return "invalid_configuration";
        }
        return "client_error";
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static final class TelegramSendException extends RuntimeException {
        private final String category;

        private TelegramSendException(String category) {
            this.category = category;
        }
    }
}
