package com.bigbike.bigbike_backend.persistence.entity.commerce.returns;

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
@Table(name = "return_history")
@Getter
@Setter
public class ReturnHistoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "return_id", nullable = false)
    private UUID returnId;

    @Column(name = "from_status", length = 32)
    private String fromStatus;

    @Column(name = "to_status", nullable = false, length = 32)
    private String toStatus;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "admin_id")
    private UUID adminId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
