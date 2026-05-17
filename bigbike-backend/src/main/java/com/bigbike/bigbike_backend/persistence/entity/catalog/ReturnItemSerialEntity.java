package com.bigbike.bigbike_backend.persistence.entity.catalog;

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
@Table(name = "return_item_serials")
@Getter
@Setter
public class ReturnItemSerialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "return_item_id", nullable = false)
    private UUID returnItemId;

    @Column(name = "serial_id", nullable = false)
    private UUID serialId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
