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
 * Ưu điểm / Nhược điểm của sản phẩm (schema.org positiveNotes / negativeNotes).
 * Một bảng con duy nhất phân biệt bằng {@code kind} = {@code PRO} / {@code CON}
 * (V175), mirror pattern {@link ProductFaqEntity}. Song ngữ inline.
 */
@Entity
@Table(name = "product_highlights")
@Getter
@Setter
public class ProductHighlightEntity {

    public static final String KIND_PRO = "PRO";
    public static final String KIND_CON = "CON";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(nullable = false, length = 8)
    private String kind;

    @Column(nullable = false)
    private int sortOrder;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    // Optional English content. Null = falls back to the Vietnamese field.
    @Column(name = "content_en", columnDefinition = "text")
    private String contentEn;

}
