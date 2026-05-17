package com.bigbike.bigbike_backend.persistence.entity.catalog;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "attribute_values")
@Getter
@Setter
public class AttributeValueEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attribute_id", nullable = false)
    private AttributeEntity attribute;

    @Column(nullable = false)
    private String slug;

    @Column(nullable = false)
    private String label;

    @Column(name = "legacy_term_id", unique = true)
    private Long legacyTermId;

    @Column(name = "color_hex")
    private String colorHex;

    @Column(name = "swatch_image_id")
    private String swatchImageId;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

}
