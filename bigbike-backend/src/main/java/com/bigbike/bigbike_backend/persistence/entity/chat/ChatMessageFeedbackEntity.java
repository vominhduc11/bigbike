package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_message_feedback")
@Getter @Setter @NoArgsConstructor
public class ChatMessageFeedbackEntity {
    @Id @GeneratedValue(strategy = GenerationType.UUID) private UUID id;
    @Column(name = "message_id", nullable = false, unique = true) private UUID messageId;
    @Column(name = "conversation_id", nullable = false) private UUID conversationId;
    @Column(nullable = false, length = 16) private String rating;
    @Column(length = 32) private String reason;
    @Column(name = "topic_code", nullable = false, length = 48) private String topicCode;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @PrePersist void create() { Instant now = Instant.now(); if (createdAt == null) createdAt = now; updatedAt = now; }
    @PreUpdate void update() { updatedAt = Instant.now(); }
}
