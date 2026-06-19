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
 * A single "Specs Dashboard" stat box rendered right under the buy area on the PDP
 * (V235) — a big {@code value} (e.g. "24 tháng") over a {@code label} (e.g. "Bảo hành").
 * Per-product, admin-authored, max 4. This is a selling-point figure, NOT a technical
 * specification row; it replaced the former {@code product_specifications.featured} flag
 * (V230). Mirrors {@link ProductCommitmentEntity}.
 */
@Entity
@Table(name = "product_spec_stats")
@Getter
@Setter
public class ProductSpecStatEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(nullable = false)
    private int sortOrder;

    /** Số liệu nổi bật (e.g. "24 tháng", "4.8★"). */
    @Column(name = "stat_value", nullable = false, length = 60)
    private String value;

    /** Nhãn dưới số liệu (e.g. "Bảo hành"). */
    @Column(nullable = false, length = 80)
    private String label;

    // Optional English content. Null = falls back to the Vietnamese field.
    @Column(name = "stat_value_en", length = 60)
    private String valueEn;

    @Column(name = "label_en", length = 80)
    private String labelEn;

}
