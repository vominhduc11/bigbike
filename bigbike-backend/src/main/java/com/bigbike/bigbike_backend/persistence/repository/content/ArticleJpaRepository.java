package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import java.util.List;
import java.util.Optional;
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

    List<ArticleEntity> findByPublishStatus(PublishStatus publishStatus);

    /**
     * Fetch full article entities by IDs.
     */
    @Query("""
            SELECT a FROM ArticleEntity a WHERE a.id IN :ids
            """)
    List<ArticleEntity> findWithAssociationsByIdIn(@Param("ids") List<String> ids);

}
