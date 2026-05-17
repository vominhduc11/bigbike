package com.bigbike.bigbike_backend.persistence.entity.commerce.payment;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "payment_events")
@Getter
@Setter
public class PaymentEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "payment_id")
    private UUID paymentId;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(length = 100)
    private String provider;

    @Column(name = "event_type", nullable = false, length = 100)
    private String eventType;

    @Column(name = "event_id", length = 255)
    private String eventId;

    @Column(columnDefinition = "text")
    private String payload;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(nullable = false, length = 50)
    private String status;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

}
