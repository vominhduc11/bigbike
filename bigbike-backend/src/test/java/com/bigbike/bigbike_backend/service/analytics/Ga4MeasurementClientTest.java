package com.bigbike.bigbike_backend.service.analytics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class Ga4MeasurementClientTest {

    private HttpServer server;
    private final AtomicInteger status = new AtomicInteger(204);
    private final AtomicInteger requestCount = new AtomicInteger();
    private final AtomicReference<String> query = new AtomicReference<>();
    private final AtomicReference<String> body = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/mp/collect", this::handle);
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void postsTheRealJsonBodyToMeasurementProtocol() {
        Ga4MeasurementClient client = client("G-TEST1234", "test-secret");

        client.send("{\"client_id\":\"1.2\",\"events\":[{\"name\":\"refund\"}]}");

        assertThat(requestCount).hasValue(1);
        assertThat(query.get()).contains("measurement_id=G-TEST1234", "api_secret=test-secret");
        assertThat(body.get()).isEqualTo(
                "{\"client_id\":\"1.2\",\"events\":[{\"name\":\"refund\"}]}");
    }

    @Test
    void reportsHttpResponsesWithoutLeakingTheSecret() {
        status.set(503);
        assertThatThrownBy(() -> client("G-TEST1234", "private-secret").send("{}"))
                .isInstanceOfSatisfying(Ga4MeasurementClient.DeliveryException.class, exception -> {
                    assertThat(exception.code()).isEqualTo("HTTP_503");
                    assertThat(exception).hasMessage("HTTP_503");
                    assertThat(exception.getMessage()).doesNotContain("private-secret");
                });

        status.set(400);
        assertThatThrownBy(() -> client("G-TEST1234", "private-secret").send("{}"))
                .isInstanceOfSatisfying(Ga4MeasurementClient.DeliveryException.class, exception -> {
                    assertThat(exception.code()).isEqualTo("HTTP_400");
                });
    }

    @Test
    void blankConfigurationMakesNoRequest() {
        Ga4MeasurementClient client = client("", "");
        assertThat(client.isEnabled()).isFalse();

        client.send("{}");

        assertThat(requestCount).hasValue(0);
    }

    private Ga4MeasurementClient client(String measurementId, String apiSecret) {
        return new Ga4MeasurementClient(
                measurementId,
                apiSecret,
                "http://127.0.0.1:" + server.getAddress().getPort());
    }

    private void handle(HttpExchange exchange) throws IOException {
        requestCount.incrementAndGet();
        query.set(exchange.getRequestURI().getRawQuery());
        body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        exchange.sendResponseHeaders(status.get(), -1);
        exchange.close();
    }
}
