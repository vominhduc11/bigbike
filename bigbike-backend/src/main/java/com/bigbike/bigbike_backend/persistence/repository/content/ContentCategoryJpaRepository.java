package com.bigbike.bigbike_backend.persistence.repository.content;

import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ContentCategoryJpaRepository extends JpaRepository<ContentCategoryEntity, String> {
    Optional<ContentCategoryEntity> findBySlug(String slug);

    /**
     * Every content category plus its count of PUBLISHED articles.
     * An article counts when the category is its primary {@code category} OR appears in its
     * many-to-many {@code categories} list — the same membership rule as the article-list
     * {@code category} filter ({@code ArticleJpaRepository#findPublishedArticleIds}).
     */
    @Query("""
            SELECT new com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount(
                c.id, c.slug, c.name,
                (SELECT COUNT(DISTINCT a.id) FROM ArticleEntity a
                 WHERE a.publishStatus = com.bigbike.bigbike_backend.domain.catalog.PublishStatus.PUBLISHED
                   AND (a.category = c OR c MEMBER OF a.categories)))
            FROM ContentCategoryEntity c
            ORDER BY c.name ASC
            """)
    List<ContentCategoryWithCount> findAllWithArticleCount();
}
