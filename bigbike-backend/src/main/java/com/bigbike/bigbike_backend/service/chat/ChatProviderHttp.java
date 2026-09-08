package com.bigbike.bigbike_backend.service.chat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientResponseException;

/** Bounds connection, upload, response headers AND body by the same remaining time. */
final class ChatProviderHttp {
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5)).build();
    private ChatProviderHttp() {}

    static String post(String endpoint, String apiKey, String json, long timeoutMillis) {
        ChatTurnBudget.checkTime();
        long timeout = ChatTurnBudget.remainingMillis(timeoutMillis);
        if (timeout <= 0) throw new ChatTurnBudget.Expired();
        var request = HttpRequest.newBuilder(URI.create(endpoint))
                .timeout(Duration.ofMillis(timeout))
                .header("x-goog-api-key", apiKey).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8)).build();
        var pending = CLIENT.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        try {
            var response = pending.get(timeout, TimeUnit.MILLISECONDS);
            ChatTurnBudget.checkTime();
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                // Never retain provider response bodies in exceptions/logs.
                throw new RestClientResponseException("AI provider request failed",
                        response.statusCode(), "", null, new byte[0], StandardCharsets.UTF_8);
            }
            return response.body();
        } catch (java.util.concurrent.TimeoutException failure) {
            throw new ChatTurnBudget.Expired();
        } catch (InterruptedException failure) {
            Thread.currentThread().interrupt();
            throw new ChatTurnBudget.Expired();
        } catch (java.util.concurrent.ExecutionException failure) {
            if (failure.getCause() instanceof java.net.http.HttpTimeoutException) throw new ChatTurnBudget.Expired();
            throw new ResourceAccessException("AI provider connection failed");
        } finally {
            pending.cancel(true);
        }
    }
}
