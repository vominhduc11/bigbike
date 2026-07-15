package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ArticleTranslations;

import com.bigbike.bigbike_backend.domain.content.ContentCategorySummary;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;

import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Primary
@Profile("!mock")
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class JpaContentReadRepository implements ContentReadRepository {

    private final ArticleJpaRepository articleJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;
    private final com.bigbike.bigbike_backend.mapper.ArticleMapper articleMapper;

    // --- Single-entity lookups ---

    @Override
    public Optional<Article> findArticleBySlug(String slug) {
        // Resolve by the vi slug first, then the optional English slug — both URLs
        // open the same article. vi-first keeps it deterministic (ARTICLE_RULE_003).
        return articleJpaRepository.findBySlug(slug)
                .or(() -> articleJpaRepository.findBySlugEn(slug))
                .map(this::toDomain);
    }

    @Override
    public Optional<Article> findArticleBySlug(String slug, String locale) {
        // vi slug first, then optional English slug (ARTICLE_RULE_003).
        return articleJpaRepository.findBySlug(slug)
                .or(() -> articleJpaRepository.findBySlugEn(slug))
                .map(e -> toDomain(e, locale));
    }

    @Override
    public Optional<Article> findArticleById(String id) {
        return articleJpaRepository.findById(id).map(this::toDomain);
    }

    // --- Full-scan for GlobalSearchService ---

    @Override
    public List<Article> findAllArticles() {
        return articleJpaRepository.findAll().stream().map(e -> toDomain(e, "vi", false)).toList();
    }

    @Override
    public List<Article> searchPublishedArticles(java.util.List<String> tokens, String locale, int limit) {
        boolean english = "en".equalsIgnoreCase(locale);
        org.springframework.data.jpa.domain.Specification<ArticleEntity> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> preds = new java.util.ArrayList<>();
            preds.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            jakarta.persistence.criteria.Expression<String> title = english
                    ? cb.<String>selectCase()
                            .when(cb.or(cb.isNull(root.get("titleEn")), cb.equal(cb.trim(root.get("titleEn")), "")), root.get("title"))
                            .otherwise(root.get("titleEn"))
                    : root.get("title");
            jakarta.persistence.criteria.Expression<String> excerpt = english
                    ? cb.<String>selectCase()
                            .when(cb.or(cb.isNull(root.get("excerptEn")), cb.equal(cb.trim(root.get("excerptEn")), "")), root.get("excerpt"))
                            .otherwise(root.get("excerptEn"))
                    : root.get("excerpt");
            for (String token : tokens) {
                String like = "%" + token.toLowerCase(java.util.Locale.ROOT) + "%";
                preds.add(cb.or(
                        cb.like(cb.lower(title), like),
                        cb.like(cb.lower(cb.coalesce(excerpt, "")), like)));
            }
            return cb.and(preds.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        List<String> ids = articleJpaRepository
                .findAll(spec, org.springframework.data.domain.PageRequest.of(0, limit))
                .getContent()
                .stream()
                .map(ArticleEntity::getId)
                .toList();
        if (ids.isEmpty()) return List.of();
        return articleJpaRepository.findWithAssociationsByIdIn(ids)
                .stream()
                .map(e -> toDomain(e, locale, false))
                .toList();
    }

    // --- DB-paginated public listing ---

    @Override
    public org.springframework.data.domain.Page<Article> listPublishedArticles(
            String categorySlug, String q, Boolean featured, Boolean homeExperience, Pageable pageable, String locale) {
        String normalizedQ = normalizeQuery(q);
        String normalizedCategory = (categorySlug != null && !categorySlug.isBlank()) ? categorySlug : null;

        org.springframework.data.domain.Page<String> idPage =
                articleJpaRepository.findPublishedArticleIds(
                        PublishStatus.PUBLISHED, normalizedCategory, normalizedQ, featured, homeExperience, pageable);

        return fetchAndOrderArticles(idPage, pageable, locale);
    }

    // --- DB-paginated admin listing ---

    @Override
    public org.springframework.data.domain.Page<Article> listArticlesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable, String locale) {
        String normalizedQ = normalizeQuery(q);

        org.springframework.data.domain.Page<String> idPage =
                articleJpaRepository.findAdminArticleIds(publishStatus, normalizedQ, pageable);

        return fetchAndOrderArticles(idPage, pageable, locale);
    }

    // --- Non-paginated filter for admin combined listing ---

    @Override
    public List<Article> findArticlesByFilter(PublishStatus publishStatus, String q, String locale) {
        return articleJpaRepository.findByFilter(publishStatus, normalizeQuery(q))
                .stream()
                .map(e -> toDomain(e, locale, false)).toList();
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    // --- Content categories with published-article counts ---

    @Override
    public List<ContentCategoryWithCount> listContentCategoriesWithCounts() {
        return contentCategoryJpaRepository.findAllWithArticleCount();
    }

    // --- Two-query helpers ---

    private org.springframework.data.domain.Page<Article> fetchAndOrderArticles(
            org.springframework.data.domain.Page<String> idPage, Pageable pageable, String locale) {
        List<String> ids = idPage.getContent();
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, idPage.getTotalElements());
        }
        List<ArticleEntity> entities = articleJpaRepository.findWithAssociationsByIdIn(ids);
        List<Article> ordered = orderByIds(entities, ids, ArticleEntity::getId)
                .stream().map(e -> toDomain(e, locale, false)).toList();
        return new PageImpl<>(ordered, pageable, idPage.getTotalElements());
    }

    private static <E> List<E> orderByIds(List<E> entities, List<String> ids, java.util.function.Function<E, String> idExtractor) {
        Map<String, E> byId = entities.stream()
                .collect(Collectors.toMap(idExtractor, e -> e, (a, b) -> a, LinkedHashMap::new));
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    // --- Entity → domain mappers ---

    private Article toDomain(ArticleEntity entity) {
        return toDomain(entity, "vi", true);
    }

    private Article toDomain(ArticleEntity entity, String locale) {
        return toDomain(entity, locale, false);
    }

    private Article toDomain(ArticleEntity entity, String locale, boolean includeTranslations) {
        return articleMapper.toDomain(entity, locale, includeTranslations);
    }

    /**
     * Map an in-memory (transient, unsaved) article entity to the public {@link Article}
     * shape — used by the admin live-preview dry-run. Same mapper as the storefront blog
     * detail ({@code includeTranslations=false} → public read).
     */
    public Article mapPreviewArticle(ArticleEntity entity, String locale) {
        return toDomain(entity, locale, false);
    }

    private static String normalizeQuery(String q) {
        return (q != null && !q.isBlank()) ? q.trim() : null;
    }
}
