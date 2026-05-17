package com.bigbike.bigbike_backend.persistence.entity.catalog;

import lombok.Getter;
import lombok.Setter;
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
@Getter
@Setter
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

}
