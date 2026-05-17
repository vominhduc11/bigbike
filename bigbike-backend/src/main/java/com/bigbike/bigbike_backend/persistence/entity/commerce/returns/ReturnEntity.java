package com.bigbike.bigbike_backend.persistence.entity.commerce.returns;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "returns")
@Getter
@Setter
public class ReturnEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "return_number", nullable = false, unique = true, length = 32)
    private String returnNumber;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(nullable = false, length = 64)
    private String reason;

    @Column(name = "customer_note", columnDefinition = "text")
    private String customerNote;

    @Column(name = "admin_note", columnDefinition = "text")
    private String adminNote;

    @Column(name = "refund_amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal refundAmount = BigDecimal.ZERO;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private Long version;

}
