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
    @Id private UUID id;
    @Column(name = "token_hash", nullable = false, unique = true, length = 64) private String tokenHash;
    @Column(name = "memory_enabled", nullable = false) private boolean memoryEnabled = true;
    @Column(name = "last_seen_at", nullable = false) private Instant lastSeenAt;
    @Column(name = "remembered_until", nullable = false) private Instant rememberedUntil;
    @Column(name = "created_at", nullable = false) private Instant createdAt;

    @PrePersist void create() { touch(); if (createdAt == null) createdAt = Instant.now(); }
    @PreUpdate void update() { if (lastSeenAt == null) touch(); }
    public void touch() {
        lastSeenAt = Instant.now();
        rememberedUntil = lastSeenAt.plus(30, ChronoUnit.DAYS);
    }
}
