package com.bigbike.bigbike_backend.service.chat;

import java.time.Duration;
import java.time.Instant;

/** One synchronous video turn: every provider leg shares the stored upload deadline and four calls. */
final class ChatTurnBudget implements AutoCloseable {
    private static final ThreadLocal<ChatTurnBudget> CURRENT = new ThreadLocal<>();
    private final ChatTurnBudget previous;
    private final long deadlineNanos;
    private final Instant deadline;
    private int providerCalls;
    private boolean textReserved;
    private int fingerprints;

    private ChatTurnBudget(Instant deadline) {
        previous = CURRENT.get();
        this.deadline = deadline;
        // Leave time for the single transcript write and HTTP response.
        long remaining = Math.max(0, Duration.between(Instant.now(), deadline).toMillis() - 750);
        deadlineNanos = System.nanoTime() + Duration.ofMillis(remaining).toNanos();
        CURRENT.set(this);
    }

    static ChatTurnBudget open(Instant deadline) { return new ChatTurnBudget(deadline); }
    static Instant deadlineOr(Instant fallback) { return active() ? CURRENT.get().deadline : fallback; }
    static boolean active() { return CURRENT.get() != null; }
    static void checkTime() {
        if (active() && (Thread.currentThread().isInterrupted() || remainingMillis(Long.MAX_VALUE) <= 0)) throw new Expired();
    }
    static long remainingMillis(long fallback) {
        ChatTurnBudget value = CURRENT.get();
        return value == null ? fallback : Math.min(fallback,
                Math.max(0, Duration.ofNanos(value.deadlineNanos - System.nanoTime()).toMillis()));
    }
    static void reserveProviderCall() {
        checkTime();
        ChatTurnBudget value = CURRENT.get();
        if (value == null) return;
        if (value.providerCalls >= 4) throw new CallsExhausted();
        value.providerCalls++;
    }
    static boolean reserveFingerprint() {
        if (!active()) return true;
        checkTime();
        return CURRENT.get().fingerprints++ < 15;
    }
    static void textSlotReserved() {
        if (active()) CURRENT.get().textReserved = true;
    }
    boolean usedTextSlot() { return textReserved; }
    int providerCalls() { return providerCalls; }
    @Override public void close() {
        if (previous == null) CURRENT.remove(); else CURRENT.set(previous);
    }
    static final class Expired extends RuntimeException {
        Expired() { super("Video turn deadline exceeded"); }
    }
    static final class CallsExhausted extends RuntimeException {
        CallsExhausted() { super("Video provider allowance exhausted"); }
    }
}
