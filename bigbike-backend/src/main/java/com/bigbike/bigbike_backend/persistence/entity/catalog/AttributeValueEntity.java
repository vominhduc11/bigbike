package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "attribute_values")
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

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public AttributeEntity getAttribute() {
        return attribute;
    }

    public void setAttribute(AttributeEntity attribute) {
        this.attribute = attribute;
    }

    public String getSlug() {
        return slug;
    }

    public void setSlug(String slug) {
        this.slug = slug;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Long getLegacyTermId() {
        return legacyTermId;
    }

    public void setLegacyTermId(Long legacyTermId) {
        this.legacyTermId = legacyTermId;
    }

    public String getColorHex() {
        return colorHex;
    }

    public void setColorHex(String colorHex) {
        this.colorHex = colorHex;
    }

    public String getSwatchImageId() {
        return swatchImageId;
    }

    public void setSwatchImageId(String swatchImageId) {
        this.swatchImageId = swatchImageId;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
