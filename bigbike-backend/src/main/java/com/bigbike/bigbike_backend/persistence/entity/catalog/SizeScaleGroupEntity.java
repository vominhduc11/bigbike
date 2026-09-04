package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "catalog_size_groups")
@Getter
@Setter
public class SizeScaleGroupEntity {

    @Id
    private String id;

    @Column(name = "group_key", nullable = false, unique = true, length = 64)
    private String groupKey;

    @Column(nullable = false)
    private String label;

    @Column(name = "label_en", nullable = false)
    private String labelEn;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active;

    /**
     * Read-only back-reference. Deliberately NOT cascading: a group delete must never
     * take its scales — and through them every configured size value — with it. Deleting
     * a group is only allowed once no scale references it (AdminSizeScaleService.deleteGroup),
     * and scale/value removal is done explicitly there.
     */
    @OneToMany(mappedBy = "group", fetch = FetchType.LAZY)
    private List<SizeScaleEntity> scales = new ArrayList<>();
}
