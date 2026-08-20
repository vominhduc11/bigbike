package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_interactions")
@Getter
@Setter
@NoArgsConstructor
public class ChatInteractionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "client_event_id", nullable = false, unique = true)
    private UUID clientEventId;

    @Column(name = "conversation_id", nullable = false)
    private UUID conversationId;

    @Column(name = "assistant_message_id", nullable = false)
    private UUID assistantMessageId;

    @Column(name = "interaction_type", nullable = false, length = 32)
    private String interactionType;

    @Column(name = "lead_prompt_sequence")
    private Integer leadPromptSequence;

    @Column(name = "action_type", length = 48)
    private String actionType;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
