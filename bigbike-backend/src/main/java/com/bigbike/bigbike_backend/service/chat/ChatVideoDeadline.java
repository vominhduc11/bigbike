package com.bigbike.bigbike_backend.service.chat;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.*;
import java.util.function.Supplier;

/** Bounds the whole video reply, including a stalled catalog/history dependency. */
final class ChatVideoDeadline {
    private static final ExecutorService WORKERS = new ThreadPoolExecutor(0, 4, 30, TimeUnit.SECONDS,
            new SynchronousQueue<>(), task -> {
                Thread thread = new Thread(task, "chat-video-turn");
                thread.setDaemon(true);
                return thread;
            });

    private ChatVideoDeadline() {}

    static <T> T call(Instant deadline, Supplier<T> work, Supplier<T> timeout) {
        long remaining = Math.max(50, Duration.between(Instant.now(), deadline).toMillis() - 250);
        Future<T> future;
        try { future = WORKERS.submit(work::get); }
        catch (RejectedExecutionException failure) { throw new ChatTurnBudget.CallsExhausted(); }
        try { return future.get(remaining, TimeUnit.MILLISECONDS); }
        catch (TimeoutException failure) {
            future.cancel(true);
            return timeout.get();
        } catch (InterruptedException failure) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            return timeout.get();
        } catch (ExecutionException failure) {
            if (failure.getCause() instanceof RuntimeException cause) throw cause;
            throw new IllegalStateException("Video turn failed", failure.getCause());
        }
    }
}
