package com.bigbike.bigbike_backend.persistence.entity.commerce.returns;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "return_items")
@Getter
@Setter
public class ReturnItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "return_id", nullable = false)
    private UUID returnId;

    @Column(name = "order_line_item_id")
    private UUID orderLineItemId;

    @Column(name = "product_name", nullable = false, columnDefinition = "text")
    private String productName;

    @Column(name = "variant_name", columnDefinition = "text")
    private String variantName;

    @Column(length = 255)
    private String sku;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(columnDefinition = "text")
    private String reason;

    @Column(name = "inspection_result", length = 20)
    private String inspectionResult;

    @Column(name = "inspection_note", columnDefinition = "text")
    private String inspectionNote;

    @Column(name = "inspected_at")
    private Instant inspectedAt;

    @Column(name = "inspected_by_admin_id")
    private UUID inspectedByAdminId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

}
