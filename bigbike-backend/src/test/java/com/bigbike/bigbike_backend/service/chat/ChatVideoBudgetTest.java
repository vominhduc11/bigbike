package com.bigbike.bigbike_backend.service.chat;

import static org.assertj.core.api.Assertions.*;
import java.time.Instant;
import java.util.concurrent.Executors;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;

class ChatVideoBudgetTest {
    @Test void wholeTurnReturnsAnApologyEvenWhenADependencyIgnoresInterruption() throws Exception {
        var release = new java.util.concurrent.CountDownLatch(1);
        var finished = new java.util.concurrent.CountDownLatch(1);
        var lateAnswer = new java.util.concurrent.atomic.AtomicBoolean(false);
        Instant deadline = Instant.now().plusMillis(1100);
        long start = System.nanoTime();
        try {
            String result = ChatVideoDeadline.call(deadline, () -> {
                try (var ignored = ChatTurnBudget.open(deadline)) {
                    boolean interrupted = false;
                    while (release.getCount() > 0) {
                        try { release.await(); } catch (InterruptedException failure) { interrupted = true; }
                    }
                    if (interrupted) Thread.currentThread().interrupt();
                    ChatTurnBudget.checkTime();
                    lateAnswer.set(true);
                    return "late answer";
                } finally { finished.countDown(); }
            }, () -> "Please send photos instead.");
            assertThat(result).isEqualTo("Please send photos instead.");
            assertThat((System.nanoTime() - start) / 1_000_000).isLessThan(1300);
        } finally { release.countDown(); }
        assertThat(finished.await(2, java.util.concurrent.TimeUnit.SECONDS)).isTrue();
        assertThat(lateAnswer).isFalse();
    }
    @Test void fourCallsAreSharedAcrossEveryStageAndRetries() {
        try (var budget = ChatTurnBudget.open(Instant.now().plusSeconds(60))) {
            for (int i = 0; i < 4; i++) ChatTurnBudget.reserveProviderCall();
            assertThatThrownBy(ChatTurnBudget::reserveProviderCall).isInstanceOf(ChatTurnBudget.CallsExhausted.class);
            assertThat(budget.providerCalls()).isEqualTo(4);
        }
        assertThat(ChatTurnBudget.active()).isFalse();
    }
    @Test void expiredStoredDeadlineDoesNotReceiveANewSixtySeconds() {
        try (var ignored = ChatTurnBudget.open(Instant.now().minusSeconds(1))) {
            assertThatThrownBy(ChatTurnBudget::checkTime).isInstanceOf(ChatTurnBudget.Expired.class);
        }
    }
    @Test void timeoutIncludesReadingAStalledResponseBody() throws Exception {
        var server = HttpServer.create(new java.net.InetSocketAddress("127.0.0.1", 0), 0);
        var executor = Executors.newSingleThreadExecutor(); server.setExecutor(executor);
        server.createContext("/", exchange -> {
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(200, 10);
            try { Thread.sleep(2000); exchange.getResponseBody().write(new byte[10]); }
            catch (Exception ignored) { } finally { exchange.close(); }
        });
        server.start();
        Class.forName(ChatProviderHttp.class.getName()); // Exclude one-time HTTP-client class initialization.
        long started = System.nanoTime();
        try (var ignored = ChatTurnBudget.open(Instant.now().plusSeconds(60))) {
            assertThatThrownBy(() -> ChatProviderHttp.post("http://127.0.0.1:" + server.getAddress().getPort(), "test", "{}", 150))
                    .isInstanceOf(ChatTurnBudget.Expired.class);
            assertThat((System.nanoTime() - started) / 1_000_000).isLessThan(1200);
        } finally { server.stop(0); executor.shutdownNow(); }
    }
}
