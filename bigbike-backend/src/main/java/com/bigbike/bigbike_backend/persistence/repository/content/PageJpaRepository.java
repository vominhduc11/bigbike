package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PageJpaRepository extends JpaRepository<PageEntity, String> {

    Optional<PageEntity> findBySlug(String slug);

    /**
     * Paginated page IDs for admin listing (any publish status).
     */
    @Query(value = """
            SELECT p.id FROM PageEntity p
            WHERE (:publishStatus IS NULL OR p.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(p.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(p.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """,
            countQuery = """
            SELECT COUNT(p) FROM PageEntity p
            WHERE (:publishStatus IS NULL OR p.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(p.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(p.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    Page<String> findAdminPageIds(
            @Param("publishStatus") PublishStatus publishStatus,
            @Param("q") String q,
            Pageable pageable);

    /**
     * Fetch full page entities by IDs with parent eager loaded.
     */
    @Query("""
            SELECT p FROM PageEntity p
            LEFT JOIN FETCH p.parent
            WHERE p.id IN :ids
            """)
    List<PageEntity> findWithParentByIdIn(@Param("ids") List<String> ids);

    /**
     * Non-paginated filtered fetch for admin combined (type=null) listing.
     */
    @Query("""
            SELECT p FROM PageEntity p
            LEFT JOIN FETCH p.parent
            WHERE (:publishStatus IS NULL OR p.publishStatus = :publishStatus)
            AND (:q IS NULL
                 OR LOWER(p.title) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
                 OR LOWER(p.slug) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
            """)
    List<PageEntity> findByFilter(
            @Param("publishStatus") PublishStatus publishStatus,
            @Param("q") String q);
}
