package com.bigbike.bigbike_backend.persistence.entity.auth;

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
@Table(name = "admin_refresh_tokens")
@Getter
@Setter
public class AdminRefreshTokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, name = "admin_user_id")
    private UUID adminUserId;

    @Column(nullable = false, unique = true, name = "token_hash", length = 255)
    private String tokenHash;

    @Column(nullable = false, name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(nullable = false, name = "created_at")
    private Instant createdAt;

    @Column(name = "created_by_ip", length = 45)
    private String createdByIp;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

}
