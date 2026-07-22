package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductJpaRepository extends JpaRepository<ProductEntity, String>, JpaSpecificationExecutor<ProductEntity> {
    /** Keyset page used by the uncapped full-catalog CSV export. */
    @Query("SELECT p FROM ProductEntity p WHERE (:afterId IS NULL OR p.id > :afterId) ORDER BY p.id ASC")
    List<ProductEntity> findForFullCsvExportAfterId(
            @Param("afterId") String afterId,
            org.springframework.data.domain.Pageable pageable
    );

    Optional<ProductEntity> findBySlug(String slug);

    /**
     * Product-level SKU has no DB uniqueness (only variant SKU does — PRODUCT_RULE_SKU_001),
     * so more than one match is possible; the bulk import upsert-matching path treats that
     * as an ambiguous row error rather than guessing which product to update.
     */
    List<ProductEntity> findAllBySkuIgnoreCase(String sku);

    /** Lookup by the optional English slug. Pairs with {@link #findBySlug} for
     * vi-first OR-resolution (JpaCatalogReadRepository) and slug uniqueness
     * checks (AdminCatalogMutationService). */
    Optional<ProductEntity> findBySlugEn(String slugEn);

    Optional<ProductEntity> findByLegacyId(String legacyId);
    long countByPublishStatus(PublishStatus publishStatus);
    long countByCategories_Id(String categoryId);

    /** Every product linked to one or more categories in the supplied set. */
    @Query("SELECT DISTINCT p FROM ProductEntity p JOIN p.categories c WHERE c.id IN :categoryIds")
    List<ProductEntity> findDistinctByCategories_IdIn(@Param("categoryIds") List<String> categoryIds);

    /** Ids of every product referencing {@code brandId}. */
    @Query("SELECT p.id FROM ProductEntity p WHERE p.brand.id = :brandId")
    List<String> findIdsByBrand_Id(@Param("brandId") String brandId);

    /**
     * Bulk-reassign every product currently pointing at {@code brandId} to
     * {@code target}. Used when a brand is hard-deleted: its products fall back to
     * the "Chưa phân loại" system brand instead of being blocked by the
     * {@code fk_products_brand_id} constraint (see
     * {@code AdminCatalogMutationService.hardDeleteBrand}, {@code BRAND_RULE_004}).
     */
    @Modifying(flushAutomatically = true)
    @Query("UPDATE ProductEntity p SET p.brand = :target, p.updatedAt = :now WHERE p.brand.id = :brandId")
    int reassignBrand(@Param("target") BrandEntity target,
                       @Param("brandId") String brandId,
                       @Param("now") Instant now);

    /**
     * Products in a given publish status. The public catalog read path
     * (listing, facets, global search) only ever needs PUBLISHED rows, so
     * filtering in SQL here avoids materialising the deep entity graph
     * (variants, gallery, videos, specs) of every DRAFT/TRASH product just
     * to discard it in a downstream Java filter.
     */
    List<ProductEntity> findByPublishStatus(PublishStatus publishStatus);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ProductEntity p WHERE p.id = :id")
    Optional<ProductEntity> findByIdForUpdate(@Param("id") String id);

    /**
     * Batch counterpart of {@link #findByIdForUpdate(String)} — locks every product in
     * {@code ids} with one round-trip instead of one {@code SELECT ... FOR UPDATE} per cart
     * line (see CheckoutService.syncPricesAndValidateStock).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ProductEntity p WHERE p.id IN :ids")
    List<ProductEntity> findAllByIdInForUpdate(@Param("ids") Collection<String> ids);

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

    // Grouped inventory queries removed 2026-07-15 (AUD-056) together with the
    // GET /admin/inventory/grouped endpoint — no caller since the standalone
    // "Kho hàng" screen was dropped (2026-06-23).

    @Query("""
        SELECT DISTINCT p FROM ProductEntity p
        LEFT JOIN FETCH p.variants
        WHERE p.id IN :ids
        ORDER BY p.name ASC
        """)
    List<ProductEntity> findByIdsWithVariants(@Param("ids") List<String> ids);

    /** Public search: DB-level filter on name + shortDescription to avoid full-table scan. */
    @Query("""
        SELECT p FROM ProductEntity p
        WHERE p.publishStatus = :status
          AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :term, '%'))
            OR LOWER(COALESCE(p.shortDescription, '')) LIKE LOWER(CONCAT('%', :term, '%')))
        ORDER BY p.name ASC
        """)
    List<ProductEntity> searchPublished(
            @Param("term") String term,
            @Param("status") PublishStatus status,
            org.springframework.data.domain.Pageable pageable);

    List<ProductEntity> findByHomepageBlockIn(Collection<HomepageBlock> blocks);

    @Query("SELECT p.slug FROM ProductEntity p WHERE p.id IN :ids AND p.slug IS NOT NULL")
    List<String> findSlugsByIds(@Param("ids") List<String> ids);

    /** (id, imageUrl) pairs — used to resolve order line-item thumbnails read-time. */
    @Query("SELECT p.id, p.imageUrl FROM ProductEntity p WHERE p.id IN :ids")
    List<Object[]> findImageUrlsByIds(@Param("ids") List<String> ids);

    @Modifying(flushAutomatically = true)
    @Query(value = "DELETE FROM home_category_highlights WHERE product_id = :productId", nativeQuery = true)
    void deleteHomeHighlightsByProductId(@Param("productId") String productId);
}
