package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "catalog_size_groups")
@Getter
@Setter
public class SizeScaleGroupEntity {

    @Id
    private String id;

    @Column(name = "group_key", nullable = false, unique = true)
    private String groupKey;

    @Column(nullable = false)
    private String label;

    @Column(name = "label_en", nullable = false)
    private String labelEn;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active;
}
