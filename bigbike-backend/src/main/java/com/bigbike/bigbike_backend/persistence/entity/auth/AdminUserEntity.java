package com.bigbike.bigbike_backend.persistence.entity.auth;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.UUID;
import com.bigbike.bigbike_backend.domain.auth.AdminRole;

@Entity
@Table(name = "admin_users")
@Getter
@Setter
public class AdminUserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(nullable = false, name = "password_hash", length = 255)
    private String passwordHash;

    @Column(nullable = false, name = "display_name", length = 255)
    private String displayName;

    @Column(nullable = false, length = 50)
    private String role;

    @ElementCollection(fetch = FetchType.EAGER, targetClass = AdminRole.class)
    @CollectionTable(
            name = "admin_user_roles",
            joinColumns = @JoinColumn(name = "admin_user_id")
    )
    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 50)
    private Set<AdminRole> roles = new LinkedHashSet<>();

    @Column(nullable = false, length = 50)
    private String status;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(nullable = false, name = "created_at")
    private Instant createdAt;

    @Column(nullable = false, name = "updated_at")
    private Instant updatedAt;

}
