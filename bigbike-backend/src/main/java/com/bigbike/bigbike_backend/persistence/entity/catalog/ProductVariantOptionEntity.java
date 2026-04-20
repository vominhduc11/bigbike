package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "product_variant_options")
public class ProductVariantOptionEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "variant_id", nullable = false)
    private ProductVariantEntity variant;

    @Column(nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private String optionName;

    @Column(nullable = false)
    private String optionValue;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ProductVariantEntity getVariant() {
        return variant;
    }

    public void setVariant(ProductVariantEntity variant) {
        this.variant = variant;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public String getOptionName() {
        return optionName;
    }

    public void setOptionName(String optionName) {
        this.optionName = optionName;
    }

    public String getOptionValue() {
        return optionValue;
    }

    public void setOptionValue(String optionValue) {
        this.optionValue = optionValue;
    }
}
