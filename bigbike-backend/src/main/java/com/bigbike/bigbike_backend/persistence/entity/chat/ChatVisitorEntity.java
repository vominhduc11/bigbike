package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_visitors")
@Getter
@Setter
@NoArgsConstructor
public class ChatVisitorEntity {

    /**
     * CHAT_RULE_049 (owner decision 2026-09-05): the assistant only remembers inside the open
     * browser session. The row still exists as the ownership key that proves a conversation and
     * its images belong to this guest, so it is kept alive just long enough for one sitting and
     * swept by the retention job afterwards.
     */
    public static final int SESSION_HOURS = 12;
    @Id private UUID id;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(name = "last_seen_at", nullable = false) private Instant lastSeenAt;
    @Column(name = "remembered_until", nullable = false) private Instant rememberedUntil;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    @PrePersist void create() { touch(); if (createdAt == null) createdAt = Instant.now(); }

    /**
     * Spring Data uses merge() for this assigned identifier, which copies a null createdAt from a
     * detached copy onto the managed row and breaks the NOT NULL column. Backfill it here.
     */
    @PreUpdate void update() {
        if (lastSeenAt == null) touch();
        if (createdAt == null) createdAt = Instant.now();
    }
    public void touch() {
        lastSeenAt = Instant.now();
        rememberedUntil = lastSeenAt.plus(SESSION_HOURS, ChronoUnit.HOURS);
    }
}
