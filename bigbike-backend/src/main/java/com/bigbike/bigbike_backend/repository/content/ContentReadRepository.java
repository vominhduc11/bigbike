package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;

public interface ContentReadRepository {

    // --- Single-entity lookups (used by services and mutation layer) ---

    Optional<Article> findArticleBySlug(String slug);

    Optional<Article> findArticleBySlug(String slug, String locale);

    Optional<Article> findArticleById(String id);

    // --- Full-scan (only for GlobalSearchService, acceptable for search use-case with limit) ---

    List<Article> findAllArticles();

    /**
     * DB-level token-AND search against title + excerpt.
     * Each token must match at least one field — "ba lo" → ["ba","lo"] finds "balo".
     */
    List<Article> searchPublishedArticles(java.util.List<String> tokens, String locale, int limit);

    // --- DB-paginated listing (replaces in-memory full-scan in ContentReadService) ---

    org.springframework.data.domain.Page<Article> listPublishedArticles(
            String categorySlug, String q, Boolean featured, Boolean homeExperience, Pageable pageable, String locale);

    // --- DB-paginated admin listing ---

    /** {@code locale} = "vi" (default) or "en"; display title falls back to Vietnamese when title_en is blank. */
    org.springframework.data.domain.Page<Article> listArticlesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable, String locale);

    // --- Non-paginated admin filter (for combined article+page admin listing) ---

    List<Article> findArticlesByFilter(PublishStatus publishStatus, String q, String locale);

    // --- Content categories with published-article counts (Tin tức filter) ---

    List<ContentCategoryWithCount> listContentCategoriesWithCounts();
}
