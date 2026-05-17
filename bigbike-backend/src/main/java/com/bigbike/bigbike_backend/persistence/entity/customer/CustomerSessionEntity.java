package com.bigbike.bigbike_backend.persistence.entity.customer;

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
@Table(name = "customer_sessions")
@Getter
@Setter
public class CustomerSessionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "session_token_hash", nullable = false, unique = true, length = 64)
    private String sessionTokenHash;

    @Column(name = "refresh_token_hash", unique = true, length = 64)
    private String refreshTokenHash;

    @Column(name = "csrf_token_hash", length = 64)
    private String csrfTokenHash;

    @Column(nullable = false, length = 50)
    private String status;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "session_expires_at", nullable = false)
    private Instant sessionExpiresAt;

    @Column(name = "refresh_expires_at")
    private Instant refreshExpiresAt;

    @Column(name = "last_active_at")
    private Instant lastActiveAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
