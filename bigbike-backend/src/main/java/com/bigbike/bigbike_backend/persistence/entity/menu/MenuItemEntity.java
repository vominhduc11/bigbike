package com.bigbike.bigbike_backend.persistence.entity.menu;

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
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "menu_items")
@Getter
@Setter
public class MenuItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_id", nullable = false)
    private MenuEntity menu;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(nullable = false, length = 255)
    private String label;

    @Column(columnDefinition = "text")
    private String url;

    @Column(name = "target_type", length = 50)
    private String targetType;

    @Column(name = "target_id")
    private UUID targetId;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "open_in_new_tab", nullable = false)
    private boolean openInNewTab = false;

    @Column(name = "css_class", length = 255)
    private String cssClass;

    @Column(nullable = false, length = 50)
    private String status;

    @Column(name = "legacy_id")
    private Long legacyId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
