package com.bigbike.bigbike_backend.persistence.entity.admin;

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
@Table(name = "admin_notifications")
@Getter
@Setter
public class AdminNotificationEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 100)
    private String type;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "order_number", length = 100)
    private String orderNumber;

    @Column(columnDefinition = "text")
    private String payload;

    @Column(name = "is_read", nullable = false)
    private boolean read = false;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
