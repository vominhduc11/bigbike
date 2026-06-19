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
 * A single trust badge on the row ABOVE the product title on the PDP
 * (e.g. "Chính hãng" / "Freeship" / "BH 2 năm"). Per-product (V233) — replaces the
 * former global {@code product_trust_genuine}/{@code product_trust_freeship} settings.
 * Mirrors {@link ProductCommitmentEntity}, simplified to a single bilingual label.
 */
@Entity
@Table(name = "product_trust_badges")
@Getter
@Setter
public class ProductTrustBadgeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(nullable = false)
    private int sortOrder;

    @Column(nullable = false, length = 200)
    private String content;

    // Optional English content. Null = falls back to the Vietnamese field.
    @Column(name = "content_en", length = 200)
    private String contentEn;

}
