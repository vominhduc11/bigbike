package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductVariantJpaRepository extends JpaRepository<ProductVariantEntity, String> {

    @Query("SELECT v FROM ProductVariantEntity v WHERE v.id = :id AND v.product.id = :productId")
    Optional<ProductVariantEntity> findByIdAndProductId(
            @Param("id") String id,
            @Param("productId") String productId
    );

    // findBySkuIgnoreCase / findByIdsWithGallery removed 2026-08-08: both existed only for the bulk
    // importer's variant SKU matching and variant-media preservation, and import no longer touches
    // variants at all (PRODUCT_RULE_009).

    /**
     * Locks every variant in {@code ids} with one round-trip instead of one
     * {@code SELECT ... FOR UPDATE} per cart line (see CheckoutService.syncPricesAndValidateStock).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM ProductVariantEntity v JOIN FETCH v.product WHERE v.id IN :ids")
    List<ProductVariantEntity> findAllByIdInForUpdate(@Param("ids") Collection<String> ids);

    // Caller passes empty string (not null) for q so Postgres can resolve lower(?) to text.
    // (Null params inside lower(...) make Postgres infer bytea — see AdminInventoryService.)
    @Query("""
        SELECT v FROM ProductVariantEntity v JOIN FETCH v.product p
        WHERE (:q = ''
               OR LOWER(CAST(v.sku AS string)) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(v.name) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%')))
          AND (:state IS NULL OR v.stockState = :state)
          AND p.publishStatus <> :trashStatus
        ORDER BY p.name ASC, v.name ASC
        """)
    List<ProductVariantEntity> searchStockAll(
            @Param("q") String q,
            @Param("state") ProductStockState state,
            @Param("trashStatus") PublishStatus trashStatus
    );

    @Query("SELECT COUNT(v) FROM ProductVariantEntity v WHERE v.stockState = :state")
    long countByStockState(@Param("state") ProductStockState state);

    boolean existsByProduct_Id(String productId);

    /**
     * SKU uniqueness pre-check (PRODUCT_RULE_SKU_001). Returns the lower-cased SKUs from
     * {@code skusLower} that are already held by a variant of a DIFFERENT product, so the
     * mutation layer can flag duplicates with a friendly error before hitting the unique
     * index. Pass {@code productId = null} on create to compare against every product.
     */
    @Query("""
        SELECT LOWER(CAST(v.sku AS string)) FROM ProductVariantEntity v
        WHERE LOWER(CAST(v.sku AS string)) IN :skusLower
          AND (:productId IS NULL OR v.product.id <> :productId)
        """)
    List<String> findTakenSkusLower(
            @Param("skusLower") Collection<String> skusLower,
            @Param("productId") String productId
    );
}
