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
@Table(name = "chat_leads")
@Getter
@Setter
@NoArgsConstructor
public class ChatLeadEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "conversation_id", nullable = false, unique = true)
    private UUID conversationId;

    @Column(length = 100)
    private String name;

    @Column(nullable = false, length = 32)
    private String phone;

    @Column(length = 500)
    private String note;

    @Column(nullable = false, length = 16)
    private String source;

    @Column(length = 32)
    private String purpose;

    @Column(name = "consented_at", nullable = false)
    private Instant consentedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (consentedAt == null) consentedAt = now;
        if (createdAt == null) createdAt = now;
        if (source == null) source = "FORM";
    }
}
