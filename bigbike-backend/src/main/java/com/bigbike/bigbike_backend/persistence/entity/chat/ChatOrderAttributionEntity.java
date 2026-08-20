package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "chat_order_attributions")
@Getter
@Setter
@NoArgsConstructor
public class ChatOrderAttributionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "order_line_item_id", nullable = false, unique = true)
    private UUID orderLineItemId;

    @Column(name = "conversation_id")
    private UUID conversationId;

    @Column(name = "interaction_id")
    private UUID interactionId;

    @Column(name = "action_type", length = 48)
    private String actionType;

    @Column(name = "attributed_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal attributedAmount;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }
}
