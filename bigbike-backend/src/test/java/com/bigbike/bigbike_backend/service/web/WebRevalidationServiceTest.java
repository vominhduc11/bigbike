package com.bigbike.bigbike_backend.service.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class WebRevalidationServiceTest {

    private HttpServer server;
    private CountDownLatch requestLatch;
    private CountDownLatch redirectClearLatch;
    private AtomicReference<String> requestBody;
    private AtomicReference<String> requestSecret;
    private AtomicReference<String> redirectClearSecret;
    private AtomicReference<String> redirectClearMethod;

    @BeforeEach
    void setUp() throws Exception {
        requestLatch = new CountDownLatch(1);
        redirectClearLatch = new CountDownLatch(1);
        requestBody = new AtomicReference<>("");
        requestSecret = new AtomicReference<>("");
        redirectClearSecret = new AtomicReference<>("");
        redirectClearMethod = new AtomicReference<>("");

        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/revalidate", exchange -> {
            requestSecret.set(exchange.getRequestHeaders().getFirst("x-revalidate-secret"));
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
            requestLatch.countDown();
        });
        server.createContext("/_internal/redirect-cache/clear", exchange -> {
            redirectClearMethod.set(exchange.getRequestMethod());
            redirectClearSecret.set(exchange.getRequestHeaders().getFirst("x-revalidate-secret"));
            byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            exchange.getResponseBody().write(body);
            exchange.close();
            redirectClearLatch.countDown();
        });
        server.start();
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void revalidate_postsDeduplicatedTagsToConfiguredWebhook() throws Exception {
        WebRevalidationService service = new WebRevalidationService(revalidateUrl(), "secret-value", "", 0, null, null);

        service.revalidate("products", "products", "product:old", "", null);

        assertThat(requestLatch.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(requestSecret.get()).isEqualTo("secret-value");
        assertThat(requestBody.get()).contains("\"tags\":[\"products\",\"product:old\"]");
    }

    @Test
    void revalidate_defersWebhookUntilTransactionCommit() throws Exception {
        WebRevalidationService service = new WebRevalidationService(revalidateUrl(), "secret-value", "", 0, null, null);

        TransactionSynchronizationManager.initSynchronization();
        service.revalidate("products");

        assertThat(requestLatch.await(150, TimeUnit.MILLISECONDS)).isFalse();

        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
        TransactionSynchronizationManager.clearSynchronization();

        assertThat(requestLatch.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBody.get()).contains("\"tags\":[\"products\"]");
    }

    @Test
    void revalidateRedirects_postsRedirectTagAndClearsDerivedL1CacheAfterCommit() throws Exception {
        WebRevalidationService service = new WebRevalidationService(revalidateUrl(), "secret-value", "", 0, null, null);

        TransactionSynchronizationManager.initSynchronization();
        service.revalidateRedirects();

        assertThat(requestLatch.await(150, TimeUnit.MILLISECONDS)).isFalse();
        assertThat(redirectClearLatch.await(150, TimeUnit.MILLISECONDS)).isFalse();

        for (TransactionSynchronization synchronization : TransactionSynchronizationManager.getSynchronizations()) {
            synchronization.afterCommit();
        }
        TransactionSynchronizationManager.clearSynchronization();

        assertThat(requestLatch.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(redirectClearLatch.await(2, TimeUnit.SECONDS)).isTrue();
        assertThat(requestBody.get()).contains("\"tags\":[\"redirects\"]");
        assertThat(requestSecret.get()).isEqualTo("secret-value");
        assertThat(redirectClearMethod.get()).isEqualTo("POST");
        assertThat(redirectClearSecret.get()).isEqualTo("secret-value");
    }

    @Test
    void constructor_failsFastWhenExpectedReplicaFanoutIsIncomplete() {
        assertThatThrownBy(() -> new WebRevalidationService(revalidateUrl(), "secret-value", "", 2, null, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("WEB_REVALIDATE_URL");
    }

    private String revalidateUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/api/revalidate";
    }
}
