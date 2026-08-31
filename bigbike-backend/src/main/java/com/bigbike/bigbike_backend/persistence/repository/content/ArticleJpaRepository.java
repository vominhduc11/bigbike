package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ArticleJpaRepository extends JpaRepository<ArticleEntity, String>, JpaSpecificationExecutor<ArticleEntity> {

    Optional<ArticleEntity> findBySlug(String slug);

    /** Lookup by the optional English slug. Pairs with {@link #findBySlug} for
     * vi-first OR-resolution (JpaContentReadRepository) and slug uniqueness
     * checks (AdminContentMutationService). */
    Optional<ArticleEntity> findBySlugEn(String slugEn);

    /**
     * Paginated article IDs for admin listing (any publish status, no category filter).
     * Searches title, slug, and excerpt.
     */
    @Query(value = """
            SELECT a.id FROM ArticleEntity a
            WHERE ((:publishStatus IS NULL AND a.publishStatus <> :trashStatus)
                OR a.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """,
            countQuery = """
            SELECT COUNT(a) FROM ArticleEntity a
            WHERE ((:publishStatus IS NULL AND a.publishStatus <> :trashStatus)
                OR a.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    Page<String> findAdminArticleIds(
            @Param("publishStatus") PublishStatus publishStatus,
            @Param("trashStatus") PublishStatus trashStatus,
            @Param("q") String q,
            Pageable pageable);

    /**
     * Fetch full article entities by IDs.
     */
    @Query("""
            SELECT a FROM ArticleEntity a WHERE a.id IN :ids
            """)
    List<ArticleEntity> findWithAssociationsByIdIn(@Param("ids") List<String> ids);

    /**
     * Non-paginated filtered fetch for admin combined (type=null) listing.
     * Returns all matching articles.
     */
    @Query("""
            SELECT a FROM ArticleEntity a
            WHERE ((:publishStatus IS NULL AND a.publishStatus <> :trashStatus)
                OR a.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    List<ArticleEntity> findByFilter(
            @Param("publishStatus") PublishStatus publishStatus,
            @Param("trashStatus") PublishStatus trashStatus,
            @Param("q") String q);
}
