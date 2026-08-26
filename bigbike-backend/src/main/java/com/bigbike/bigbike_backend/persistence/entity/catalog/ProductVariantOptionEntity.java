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

@Entity
@Table(name = "product_variant_options")
@Getter
@Setter
public class ProductVariantOptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariantEntity variant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attribute_id", nullable = false)
    private AttributeEntity attribute;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attribute_value_id", nullable = false)
    private AttributeValueEntity attributeValue;

    @Column(nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private String optionName;

    @Column(nullable = false)
    private String optionValue;

    /**
     * The original option text for rows repaired from legacy free-text data.
     * These snapshots are deliberately private to the persistence layer: the
     * public catalog keeps showing the text customers already saw, while the
     * admin editor uses the linked dictionary labels.
     */
    @Column(name = "legacy_display_name")
    private String legacyDisplayName;

    @Column(name = "legacy_display_value")
    private String legacyDisplayValue;

}
