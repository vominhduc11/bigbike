package com.bigbike.bigbike_backend.service.checkout;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class TelegramOrderNotificationServiceTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private HttpServer fakeTelegram;
    private final AtomicInteger requestCount = new AtomicInteger();
    private final AtomicReference<String> requestBody = new AtomicReference<>();

    @AfterEach
    void stopFakeTelegram() {
        if (fakeTelegram != null) {
            fakeTelegram.stop(0);
        }
    }

    @Test
    void missingCredentialsDisableTelegramWithoutMakingARequest() {
        TelegramOrderNotificationService service = new TelegramOrderNotificationService(
                "", "", "http://127.0.0.1:1", 1, "http://admin.test");

        assertThatCode(() -> service.sendNewOrderNotification(snapshot(List.of()))).doesNotThrowAnyException();
        assertThat(requestCount).hasValue(0);
    }

    @Test
    void providerFailureIsSwallowedByTheAsyncSafeBoundary() {
        String baseUrl = startFakeTelegram(500, "{\"ok\":false,\"description\":\"failed\"}");
        TelegramOrderNotificationService service = new TelegramOrderNotificationService(
                "test-token", "test-chat", baseUrl, 1, "http://admin.test");

        assertThatCode(() -> service.sendNewOrderNotification(snapshot(List.of()))).doesNotThrowAnyException();
        assertThat(requestCount).hasValue(1);
    }

    @Test
    void fakeTelegramIsNotCalledBeforeTheAfterCommitCallback() {
        String baseUrl = startFakeTelegram(200, "{\"ok\":true,\"result\":{}}");
        TelegramOrderNotificationService service = new TelegramOrderNotificationService(
                "test-token", "test-chat", baseUrl, 1, "http://admin.test");

        TransactionSynchronizationManager.initSynchronization();
        try {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    service.sendNewOrderNotification(snapshot(List.of()));
                }
            });

            assertThat(requestCount).hasValue(0);
            TransactionSynchronizationManager.getSynchronizations()
                    .forEach(TransactionSynchronization::afterCommit);
            assertThat(requestCount).hasValue(1);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void dynamicHtmlValuesAreEscapedAndAdminLinkIsIncluded() throws Exception {
        String baseUrl = startFakeTelegram(200, "{\"ok\":true,\"result\":{}}");
        TelegramOrderNotificationService service = new TelegramOrderNotificationService(
                "test-token", "test-chat", baseUrl, 1, "https://admin.bigbike.test");
        TelegramOrderSnapshot order = new TelegramOrderSnapshot(
                UUID.randomUUID(),
                "BB2609050018",
                "An <An> & B",
                "0906902404",
                "an&b@example.com",
                new BigDecimal("4850000"),
                "VND",
                "COD",
                "checkout",
                List.of(new TelegramOrderSnapshot.LineItem(
                        "Mũ <A> & B",
                        "Đen nhám, size \"L\"",
                        1,
                        new BigDecimal("4200000"))));

        service.sendNow(order);

        JsonNode request = JSON.readTree(requestBody.get());
        String text = request.path("text").asText();
        assertThat(request.path("parse_mode").asText()).isEqualTo("HTML");
        assertThat(text).contains("<b>🛒 ĐƠN HÀNG MỚI</b>");
        assertThat(text).contains("An &lt;An&gt; &amp; B");
        assertThat(text).contains("Mũ &lt;A&gt; &amp; B — Đen nhám, size &quot;L&quot;");
        assertThat(text).contains("<code>0906902404</code>");
        assertThat(text).contains("<a href=\"https://admin.bigbike.test/orders/");
        assertThat(text).doesNotContain("null");
    }

    @Test
    void longMultiItemOrderKeepsTenLinesAndStaysWithinTelegramLimit() throws Exception {
        String baseUrl = startFakeTelegram(200, "{\"ok\":true,\"result\":{}}");
        TelegramOrderNotificationService service = new TelegramOrderNotificationService(
                "test-token", "test-chat", baseUrl, 1, "https://admin.bigbike.test");
        List<TelegramOrderSnapshot.LineItem> items = new ArrayList<>();
        for (int index = 1; index <= 25; index++) {
            items.add(new TelegramOrderSnapshot.LineItem(
                    "Sản phẩm " + index + " " + "x".repeat(600),
                    "Phiên bản " + index + " " + "y".repeat(300),
                    index,
                    BigDecimal.valueOf(index * 100000L)));
        }

        service.sendNow(snapshot(items));

        String text = JSON.readTree(requestBody.get()).path("text").asText();
        assertThat(text.length()).isLessThanOrEqualTo(4096);
        assertThat(text).contains("Sản phẩm 1");
        assertThat(text).contains("Sản phẩm 10");
        assertThat(text).doesNotContain("Sản phẩm 11");
        assertThat(text).contains("… và 15 món khác");
        assertThat(text).contains("</b>");
        assertThat(text).contains("</a>");
    }

    private TelegramOrderSnapshot snapshot(List<TelegramOrderSnapshot.LineItem> items) {
        return new TelegramOrderSnapshot(
                UUID.randomUUID(),
                "BB-TEST-001",
                "Nguyễn Văn An",
                "0906902404",
                null,
                new BigDecimal("4850000"),
                "VND",
                "COD",
                "checkout",
                items);
    }

    private String startFakeTelegram(int status, String response) {
        try {
            fakeTelegram = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        } catch (IOException exception) {
            throw new IllegalStateException(exception);
        }
        fakeTelegram.createContext("/", exchange -> {
            requestCount.incrementAndGet();
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] responseBytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, responseBytes.length);
            exchange.getResponseBody().write(responseBytes);
            exchange.close();
        });
        fakeTelegram.start();
        return "http://127.0.0.1:" + fakeTelegram.getAddress().getPort();
    }
}
