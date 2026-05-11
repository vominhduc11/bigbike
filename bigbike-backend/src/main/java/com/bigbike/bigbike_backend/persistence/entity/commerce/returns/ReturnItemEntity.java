package com.bigbike.bigbike_backend.persistence.entity.commerce.returns;

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

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getReturnId() { return returnId; }
    public void setReturnId(UUID returnId) { this.returnId = returnId; }

    public UUID getOrderLineItemId() { return orderLineItemId; }
    public void setOrderLineItemId(UUID orderLineItemId) { this.orderLineItemId = orderLineItemId; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public String getVariantName() { return variantName; }
    public void setVariantName(String variantName) { this.variantName = variantName; }

    public String getSku() { return sku; }
    public void setSku(String sku) { this.sku = sku; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getInspectionResult() { return inspectionResult; }
    public void setInspectionResult(String inspectionResult) { this.inspectionResult = inspectionResult; }

    public String getInspectionNote() { return inspectionNote; }
    public void setInspectionNote(String inspectionNote) { this.inspectionNote = inspectionNote; }

    public Instant getInspectedAt() { return inspectedAt; }
    public void setInspectedAt(Instant inspectedAt) { this.inspectedAt = inspectedAt; }

    public UUID getInspectedByAdminId() { return inspectedByAdminId; }
    public void setInspectedByAdminId(UUID inspectedByAdminId) { this.inspectedByAdminId = inspectedByAdminId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
