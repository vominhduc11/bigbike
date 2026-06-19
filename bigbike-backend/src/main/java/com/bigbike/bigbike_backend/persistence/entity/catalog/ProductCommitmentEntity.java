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
 * A single product commitment row rendered under the buy buttons on the PDP
 * (delivery / exchange / warranty …). Per-product (V232) — replaces the former
 * global {@code public_product} commitment settings. Mirrors {@link ProductFaqEntity}.
 */
@Entity
@Table(name = "product_commitments")
@Getter
@Setter
public class ProductCommitmentEntity {

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
    private String title;

    @Column(length = 300)
    private String subtitle;

    // Optional English content. Null = falls back to the Vietnamese field.
    @Column(name = "title_en", length = 200)
    private String titleEn;

    @Column(name = "subtitle_en", length = 300)
    private String subtitleEn;

}
