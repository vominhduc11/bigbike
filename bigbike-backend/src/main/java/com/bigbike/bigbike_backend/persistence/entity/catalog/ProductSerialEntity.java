package com.bigbike.bigbike_backend.persistence.entity.catalog;

import com.bigbike.bigbike_backend.domain.catalog.ProductSerialStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "product_serials")
public class ProductSerialEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_variant_id")
    private ProductVariantEntity variant;

    @Column(name = "serial_number", length = 100, nullable = false)
    private String serialNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductSerialStatus status;

    @Column(name = "reserved_until")
    private Instant reservedUntil;

    @Column(name = "order_line_item_id")
    private UUID orderLineItemId;

    @Column(name = "return_item_id")
    private UUID returnItemId;

    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;

    @Column(name = "sold_at")
    private Instant soldAt;

    @Column(name = "returned_at")
    private Instant returnedAt;

    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "admin_id")
    private UUID adminId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public ProductEntity getProduct() { return product; }
    public void setProduct(ProductEntity product) { this.product = product; }

    public ProductVariantEntity getVariant() { return variant; }
    public void setVariant(ProductVariantEntity variant) { this.variant = variant; }

    public String getSerialNumber() { return serialNumber; }
    public void setSerialNumber(String serialNumber) { this.serialNumber = serialNumber; }

    public ProductSerialStatus getStatus() { return status; }
    public void setStatus(ProductSerialStatus status) { this.status = status; }

    public Instant getReservedUntil() { return reservedUntil; }
    public void setReservedUntil(Instant reservedUntil) { this.reservedUntil = reservedUntil; }

    public UUID getOrderLineItemId() { return orderLineItemId; }
    public void setOrderLineItemId(UUID orderLineItemId) { this.orderLineItemId = orderLineItemId; }

    public UUID getReturnItemId() { return returnItemId; }
    public void setReturnItemId(UUID returnItemId) { this.returnItemId = returnItemId; }

    public Instant getReceivedAt() { return receivedAt; }
    public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }

    public Instant getSoldAt() { return soldAt; }
    public void setSoldAt(Instant soldAt) { this.soldAt = soldAt; }

    public Instant getReturnedAt() { return returnedAt; }
    public void setReturnedAt(Instant returnedAt) { this.returnedAt = returnedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public UUID getAdminId() { return adminId; }
    public void setAdminId(UUID adminId) { this.adminId = adminId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
