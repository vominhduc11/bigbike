package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * A reviewed legacy product page that no longer has a sellable Product row.
 * It deliberately does not model price, stock, SKU or checkout data.
 */
@Entity
@Table(name = "legacy_discontinued_products")
@Getter
@Setter
public class LegacyDiscontinuedProductEntity {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String slug;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "name_en", length = 255)
    private String nameEn;

    @Column(name = "brand_name", length = 255)
    private String brandName;

    @Column(name = "category_slug", nullable = false, length = 255)
    private String categorySlug;

    @Column(name = "image_url", length = 2048)
    private String imageUrl;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
