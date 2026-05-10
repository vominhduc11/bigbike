package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_line_item_serials")
public class OrderLineItemSerialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_line_item_id", nullable = false)
    private UUID orderLineItemId;

    @Column(name = "serial_id", nullable = false)
    private UUID serialId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOrderLineItemId() { return orderLineItemId; }
    public void setOrderLineItemId(UUID orderLineItemId) { this.orderLineItemId = orderLineItemId; }

    public UUID getSerialId() { return serialId; }
    public void setSerialId(UUID serialId) { this.serialId = serialId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
