package com.bigbike.bigbike_backend.persistence.entity.commerce.order;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "checkout_idempotency_keys",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_checkout_idempotency_flow_scope_key",
                columnNames = {"flow_type", "scope_key", "idempotency_key"}
        )
)
@Getter
@Setter
public class CheckoutIdempotencyKeyEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "flow_type", nullable = false, length = 50)
    private String flowType;

    @Column(name = "scope_key", nullable = false, length = 255)
    private String scopeKey;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "guest_session_id", length = 255)
    private String guestSessionId;

    @Column(name = "idempotency_key", nullable = false, length = 255)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
