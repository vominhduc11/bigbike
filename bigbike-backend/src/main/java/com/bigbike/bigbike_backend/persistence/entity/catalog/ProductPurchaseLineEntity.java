package com.bigbike.bigbike_backend.persistence.entity.catalog;

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

/**
 * A single "Mua tại BigBike.vn" line rendered in the purchase block on the PDP
 * (Bảo hành / Giao hàng / Đổi trả …). Per-product (V249) — admin tự thêm/bớt mỗi
 * dòng (nhãn + giá trị + icon). Mirrors {@link ProductCommitmentEntity}.
 */
@Entity
@Table(name = "product_purchase_lines")
@Getter
@Setter
public class ProductPurchaseLineEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(nullable = false)
    private int sortOrder;

    /** Icon key from the fixed web set (e.g. {@code truck}); unknown → web falls back to {@code shield-check}. */
    @Column(nullable = false, length = 40)
    private String icon;

    @Column(nullable = false, length = 200)
    private String label;

    @Column(length = 300)
    private String value;

    // Optional English content. Null = falls back to the Vietnamese field.
    @Column(name = "label_en", length = 200)
    private String labelEn;

    @Column(name = "value_en", length = 300)
    private String valueEn;

}
