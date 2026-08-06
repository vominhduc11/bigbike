package com.bigbike.bigbike_backend.persistence.entity.maintenance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * Singleton row (id = 1) holding the admin-panel maintenance lock state.
 *
 * <p>Deliberately NOT a {@code site_settings} row: the admin settings screen lists
 * {@code settingRepo.findAll()} without consulting the definition registry, and every
 * registry-driven guard treats an unregistered key as unrestricted — which would let any
 * {@code settings.write} holder flip the lock. A dedicated table makes that structurally
 * unreachable. See V374 for the full rationale.
 */
@Entity
@Table(name = "maintenance_state")
@Getter
@Setter
public class MaintenanceStateEntity {

    /** The only valid id. The table has a {@code CHECK (id = 1)} constraint. */
    public static final short SINGLETON_ID = 1;

    @Id
    private Short id = SINGLETON_ID;

    @Column(name = "state", nullable = false, length = 16)
    private String state;

    /** Free-text note the developer leaves for staff, shown on the admin overlay. */
    @Column(name = "staff_note", columnDefinition = "text")
    private String staffNote;

    /** Display-only estimate of when work finishes. Never drives a transition. */
    @Column(name = "expected_at")
    private Instant expectedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onPrePersist() {
        if (id == null) id = SINGLETON_ID;
        if (updatedAt == null) updatedAt = Instant.now();
    }

    @PreUpdate
    void onPreUpdate() {
        updatedAt = Instant.now();
    }
}
