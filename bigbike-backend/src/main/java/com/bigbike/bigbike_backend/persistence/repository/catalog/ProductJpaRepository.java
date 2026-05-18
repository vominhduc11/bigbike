package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.Nullable;

public interface ProductJpaRepository extends JpaRepository<ProductEntity, String>, JpaSpecificationExecutor<ProductEntity> {
    Optional<ProductEntity> findBySlug(String slug);
    Optional<ProductEntity> findByLegacyId(String legacyId);
    long countByPublishStatus(PublishStatus publishStatus);
    long countByCategory_Id(String categoryId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ProductEntity p WHERE p.id = :id")
    Optional<ProductEntity> findByIdForUpdate(@Param("id") String id);

    @Query("""
        SELECT p FROM ProductEntity p
        WHERE NOT EXISTS (SELECT 1 FROM ProductVariantEntity v WHERE v.product = p)
          AND p.publishStatus <> :trashStatus
          AND (:q = ''
               OR LOWER(p.name) LIKE LOWER(CONCAT('%', :q, '%'))
               OR LOWER(CAST(p.sku AS string)) LIKE LOWER(CONCAT('%', :q, '%')))
          AND (:state IS NULL OR p.stockState = :state)
        ORDER BY p.name ASC
        """)
    List<ProductEntity> searchNoVariantStock(
            @Param("q") String q,
            @Param("state") ProductStockState state,
            @Param("trashStatus") PublishStatus trashStatus
    );

    @Query("""
        SELECT COUNT(p) FROM ProductEntity p
        WHERE NOT EXISTS (SELECT 1 FROM ProductVariantEntity v WHERE v.product = p)
          AND p.publishStatus <> :trashStatus
        """)
    long countNoVariantStock(@Param("trashStatus") PublishStatus trashStatus);

    @Query("""
        SELECT COUNT(p) FROM ProductEntity p
        WHERE NOT EXISTS (SELECT 1 FROM ProductVariantEntity v WHERE v.product = p)
          AND p.publishStatus <> :trashStatus
          AND p.stockState = :state
        """)
    long countNoVariantStockByState(
            @Param("trashStatus") PublishStatus trashStatus,
            @Param("state") ProductStockState state
    );

    // ── Grouped inventory queries ─────────────────────────────────────────────

    @Query("""
        SELECT COUNT(DISTINCT p.id) FROM ProductEntity p
        JOIN p.variants v
        WHERE p.publishStatus <> :trashStatus
          AND (:q = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(CAST(p.sku AS string)) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(v.name) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(CAST(v.sku AS string)) LIKE LOWER(CONCAT('%',:q,'%')))
          AND (:state IS NULL OR v.stockState = :state)
        """)
    long countProductsWithVariantStock(
            @Param("q") String q,
            @Param("state") @Nullable ProductStockState state,
            @Param("trashStatus") PublishStatus trashStatus
    );

    @Query("""
        SELECT COUNT(p) FROM ProductEntity p
        WHERE NOT EXISTS (SELECT 1 FROM ProductVariantEntity v WHERE v.product = p)
          AND p.publishStatus <> :trashStatus
          AND (:q = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(CAST(p.sku AS string)) LIKE LOWER(CONCAT('%',:q,'%')))
          AND (:state IS NULL OR p.stockState = :state)
        """)
    long countNoVariantStockByQueryAndState(
            @Param("q") String q,
            @Param("state") @Nullable ProductStockState state,
            @Param("trashStatus") PublishStatus trashStatus
    );

    @Query("""
        SELECT DISTINCT p.id, p.name FROM ProductEntity p
        JOIN p.variants v
        WHERE p.publishStatus <> :trashStatus
          AND (:q = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(CAST(p.sku AS string)) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(v.name) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(CAST(v.sku AS string)) LIKE LOWER(CONCAT('%',:q,'%')))
          AND (:state IS NULL OR v.stockState = :state)
        """)
    List<Object[]> findProductIdAndNameWithVariantStock(
            @Param("q") String q,
            @Param("state") @Nullable ProductStockState state,
            @Param("trashStatus") PublishStatus trashStatus
    );

    @Query("""
        SELECT p.id, p.name FROM ProductEntity p
        WHERE NOT EXISTS (SELECT 1 FROM ProductVariantEntity v WHERE v.product = p)
          AND p.publishStatus <> :trashStatus
          AND (:q = '' OR LOWER(p.name) LIKE LOWER(CONCAT('%',:q,'%'))
               OR LOWER(CAST(p.sku AS string)) LIKE LOWER(CONCAT('%',:q,'%')))
          AND (:state IS NULL OR p.stockState = :state)
        """)
    List<Object[]> findNoVariantProductIdAndName(
            @Param("q") String q,
            @Param("state") @Nullable ProductStockState state,
            @Param("trashStatus") PublishStatus trashStatus
    );

    @Query("""
        SELECT DISTINCT p FROM ProductEntity p
        LEFT JOIN FETCH p.variants
        WHERE p.id IN :ids
        ORDER BY p.name ASC
        """)
    List<ProductEntity> findByIdsWithVariants(@Param("ids") List<String> ids);

    @Query("SELECT p.slug FROM ProductEntity p WHERE p.id IN :ids AND p.slug IS NOT NULL")
    List<String> findSlugsByIds(@Param("ids") List<String> ids);

    /** (id, imageUrl) pairs — used to resolve order line-item thumbnails read-time. */
    @Query("SELECT p.id, p.imageUrl FROM ProductEntity p WHERE p.id IN :ids")
    List<Object[]> findImageUrlsByIds(@Param("ids") List<String> ids);
}
