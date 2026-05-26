package com.bigbike.bigbike_backend.persistence.entity.home;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "home_category_highlights")
@Getter
@Setter
@NoArgsConstructor
public class HomeHighlightEntity {

    @Id
    @Column(columnDefinition = "smallint")
    private Short slot;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private ProductEntity product;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
