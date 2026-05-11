package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ArticleJpaRepository extends JpaRepository<ArticleEntity, String> {

    Optional<ArticleEntity> findBySlug(String slug);

    /**
     * Paginated article IDs for the public listing.
     * Uses LEFT JOIN for category to preserve articles with no category when filter is absent.
     * Uses EXISTS subquery for multi-category filter to avoid row duplication.
     */
    @Query(value = """
            SELECT a.id FROM ArticleEntity a LEFT JOIN a.category primaryCat
            WHERE a.publishStatus = :publishStatus
            AND (:categorySlug IS NULL
                 OR primaryCat.slug = :categorySlug
                 OR EXISTS (SELECT 1 FROM a.categories c WHERE c.slug = :categorySlug))
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """,
            countQuery = """
            SELECT COUNT(a) FROM ArticleEntity a LEFT JOIN a.category primaryCat
            WHERE a.publishStatus = :publishStatus
            AND (:categorySlug IS NULL
                 OR primaryCat.slug = :categorySlug
                 OR EXISTS (SELECT 1 FROM a.categories c WHERE c.slug = :categorySlug))
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    Page<String> findPublishedArticleIds(
            @Param("publishStatus") PublishStatus publishStatus,
            @Param("categorySlug") String categorySlug,
            @Param("q") String q,
            Pageable pageable);

    /**
     * Paginated article IDs for admin listing (any publish status, no category filter).
     * Searches title, slug, and excerpt.
     */
    @Query(value = """
            SELECT a.id FROM ArticleEntity a
            WHERE (:publishStatus IS NULL OR a.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """,
            countQuery = """
            SELECT COUNT(a) FROM ArticleEntity a
            WHERE (:publishStatus IS NULL OR a.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    Page<String> findAdminArticleIds(
            @Param("publishStatus") PublishStatus publishStatus,
            @Param("q") String q,
            Pageable pageable);

    /**
     * Fetch full article entities by IDs with eager ManyToOne associations.
     * ManyToMany (categories, tags) are loaded in batch via @BatchSize on the entity.
     */
    @Query("""
            SELECT a FROM ArticleEntity a
            LEFT JOIN FETCH a.author
            LEFT JOIN FETCH a.category
            WHERE a.id IN :ids
            """)
    List<ArticleEntity> findWithAssociationsByIdIn(@Param("ids") List<String> ids);

    /**
     * Non-paginated filtered fetch for admin combined (type=null) listing.
     * Returns all matching articles with eager ManyToOne associations.
     */
    @Query("""
            SELECT a FROM ArticleEntity a
            LEFT JOIN FETCH a.author
            LEFT JOIN FETCH a.category
            WHERE (:publishStatus IS NULL OR a.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(a.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.excerpt) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(a.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    List<ArticleEntity> findByFilter(
            @Param("publishStatus") PublishStatus publishStatus,
            @Param("q") String q);
}
