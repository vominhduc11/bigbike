package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "attributes")
public class AttributeEntity {

    @Id
    private String id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String kind;

    @Column(name = "is_variation", nullable = false)
    private boolean variation;

    @Column(name = "legacy_taxonomy_id", unique = true)
    private Long legacyTaxonomyId;

    @OneToMany(mappedBy = "attribute", fetch = FetchType.LAZY)
    private List<AttributeValueEntity> values = new ArrayList<>();

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public boolean isVariation() {
        return variation;
    }

    public void setVariation(boolean variation) {
        this.variation = variation;
    }

    public Long getLegacyTaxonomyId() {
        return legacyTaxonomyId;
    }

    public void setLegacyTaxonomyId(Long legacyTaxonomyId) {
        this.legacyTaxonomyId = legacyTaxonomyId;
    }

    public List<AttributeValueEntity> getValues() {
        return values;
    }

    public void setValues(List<AttributeValueEntity> values) {
        this.values = values;
    }
}
