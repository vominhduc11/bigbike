package com.bigbike.bigbike_backend.persistence.entity.shipping;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shipping_methods")
@Getter
@Setter
public class ShippingMethodEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "zone_id", nullable = false)
    private ShippingZoneEntity zone;

    @Column(name = "legacy_id")
    private Long legacyId;

    @Column(name = "method_code", nullable = false, length = 100)
    private String methodCode;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(precision = 19, scale = 2)
    private BigDecimal cost;

    @Column(name = "min_order_amount", precision = 19, scale = 2)
    private BigDecimal minOrderAmount;

    @Column(name = "free_shipping_threshold", precision = 19, scale = 2)
    private BigDecimal freeShippingThreshold;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(columnDefinition = "text")
    private String settings;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
