package com.bigbike.bigbike_backend.persistence.entity.commerce.order;

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
@Table(name = "order_line_items")
@Getter
@Setter
public class OrderLineItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OrderEntity order;

    @Column(name = "legacy_item_id")
    private Long legacyItemId;

    @Column(name = "product_id")
    private UUID productId;

    @Column(name = "product_pk", length = 64)
    private String productPk;

    @Column(name = "product_variant_id")
    private UUID productVariantId;

    @Column(name = "product_variant_pk", length = 64)
    private String productVariantPk;

    @Column(length = 255)
    private String sku;

    @Column(name = "product_name", nullable = false, columnDefinition = "text")
    private String productName;

    @Column(name = "variant_name", columnDefinition = "text")
    private String variantName;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "unit_price", nullable = false, precision = 19, scale = 2)
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(name = "regular_price", precision = 19, scale = 2)
    private BigDecimal regularPrice;

    @Column(name = "sale_price", precision = 19, scale = 2)
    private BigDecimal salePrice;

    @Column(name = "line_subtotal", nullable = false, precision = 19, scale = 2)
    private BigDecimal lineSubtotal = BigDecimal.ZERO;

    @Column(name = "line_discount", nullable = false, precision = 19, scale = 2)
    private BigDecimal lineDiscount = BigDecimal.ZERO;

    @Column(name = "line_tax", nullable = false, precision = 19, scale = 2)
    private BigDecimal lineTax = BigDecimal.ZERO;

    @Column(name = "line_total", nullable = false, precision = 19, scale = 2)
    private BigDecimal lineTotal = BigDecimal.ZERO;

    @Column(columnDefinition = "text")
    private String metadata;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    /**
     * Variant identity for inventory ops. Regular products store the variant in the UUID
     * column {@code productVariantId}; migrated / admin-created variants use a varchar string
     * PK that does not fit a UUID, so it is snapshotted in {@code productVariantPk} (see V158).
     * Returns {@code null} when the line is not variant-level.
     */
    public String resolveVariantKey() {
        if (productVariantId != null) {
            return productVariantId.toString();
        }
        if (productVariantPk != null && !productVariantPk.isBlank()) {
            return productVariantPk;
        }
        return null;
    }

    /**
     * Product identity for inventory ops. Mirrors {@link #resolveVariantKey()}: UUID column
     * {@code productId} for regular products, varchar {@code productPk} for migrated /
     * admin-created products (see V74). Returns {@code null} when neither is set.
     */
    public String resolveProductKey() {
        if (productId != null) {
            return productId.toString();
        }
        if (productPk != null && !productPk.isBlank()) {
            return productPk;
        }
        return null;
    }

}
