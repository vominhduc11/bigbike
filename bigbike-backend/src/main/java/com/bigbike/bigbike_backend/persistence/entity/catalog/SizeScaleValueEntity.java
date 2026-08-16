package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(
        name = "catalog_size_values",
        uniqueConstraints = @UniqueConstraint(name = "uq_catalog_size_values_scale_key", columnNames = {"scale_id", "value_key"})
)
@Getter
@Setter
public class SizeScaleValueEntity {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "scale_id", nullable = false)
    private SizeScaleEntity scale;

    @Column(name = "value_key", nullable = false, length = 64)
    private String valueKey;

    @Column(nullable = false)
    private String label;

    @Column(name = "label_en", nullable = false)
    private String labelEn;

    @Column(name = "subgroup_key", length = 64)
    private String subgroupKey;

    @Column(name = "subgroup_label")
    private String subgroupLabel;

    @Column(name = "subgroup_label_en")
    private String subgroupLabelEn;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active;
}
