package com.bigbike.bigbike_backend.persistence.entity.contact;

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
@Table(name = "contact_messages")
@Getter
@Setter
public class ContactMessageEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "full_name", nullable = false, length = 255)
    private String fullName;

    @Column(nullable = false, length = 50)
    private String phone;

    @Column(length = 255)
    private String email;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(nullable = false, length = 20)
    private String status = "OPEN";

    @Column(name = "admin_note", columnDefinition = "text")
    private String adminNote;

    @Column(name = "assigned_admin_id")
    private UUID assignedAdminId;

    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

}
