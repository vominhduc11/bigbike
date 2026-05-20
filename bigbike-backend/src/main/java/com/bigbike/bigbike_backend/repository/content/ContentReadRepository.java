package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;
import com.bigbike.bigbike_backend.domain.content.Page;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;

public interface ContentReadRepository {

    // --- Single-entity lookups (used by services and mutation layer) ---

    Optional<Article> findArticleBySlug(String slug);

    Optional<Article> findArticleBySlug(String slug, String locale);

    Optional<Article> findArticleById(String id);

    Optional<Page> findPageBySlug(String slug);

    Optional<Page> findPageBySlug(String slug, String locale);

    Optional<Page> findPageById(String id);

    // --- Full-scan (only for GlobalSearchService, acceptable for search use-case with limit) ---

    List<Article> findAllArticles();

    // --- DB-paginated listing (replaces in-memory full-scan in ContentReadService) ---

    org.springframework.data.domain.Page<Article> listPublishedArticles(
            String categorySlug, String q, Pageable pageable, String locale);

    // --- DB-paginated admin listing ---

    org.springframework.data.domain.Page<Article> listArticlesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable);

    org.springframework.data.domain.Page<Page> listPagesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable);

    // --- Non-paginated admin filter (for combined article+page admin listing) ---

    List<Article> findArticlesByFilter(PublishStatus publishStatus, String q);

    List<Page> findPagesByFilter(PublishStatus publishStatus, String q);

    // --- Content categories with published-article counts (Tin tức filter) ---

    List<ContentCategoryWithCount> listContentCategoriesWithCounts();
}
