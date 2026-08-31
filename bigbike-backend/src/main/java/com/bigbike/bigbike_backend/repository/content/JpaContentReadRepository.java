package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ArticleTranslations;

import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.service.search.StorefrontSearchRules;
import com.bigbike.bigbike_backend.util.AdminSearchText;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
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
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Primary
@Profile("!mock")
@Transactional(readOnly = true)
@RequiredArgsConstructor
public class JpaContentReadRepository implements ContentReadRepository {

    private final ArticleJpaRepository articleJpaRepository;
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
        List<String> literalTerms = tokens == null
                ? List.of()
                : tokens.stream().map(StorefrontSearchRules::normalizeText).filter(term -> !term.isEmpty()).toList();
        if (literalTerms.isEmpty() || limit <= 0) {
            return List.of();
        }
        List<String> ids = articleJpaRepository
                .findAll(
                        storefrontArticleSpecification(literalTerms, null, null, locale),
                        org.springframework.data.domain.PageRequest.of(
                                0, limit, Sort.by(Sort.Direction.DESC, "publishedAt")))
                .getContent()
                .stream()
                .map(ArticleEntity::getId)
                .toList();
        if (ids.isEmpty()) return List.of();
        return orderByIds(articleJpaRepository.findWithAssociationsByIdIn(ids), ids, ArticleEntity::getId)
                .stream()
                .map(e -> toDomain(e, locale, false))
                .toList();
    }

    @Override
    public List<ContentReadRepository.ArticleKnowledge> searchPublishedArticleKnowledge(
            java.util.List<String> tokens, String locale, int limit) {
        boolean english = "en".equalsIgnoreCase(locale);
        org.springframework.data.jpa.domain.Specification<ArticleEntity> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
            predicates.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            if (english) {
                predicates.add(cb.isNotNull(root.get("titleEn")));
                predicates.add(cb.notEqual(cb.trim(root.get("titleEn")), ""));
                predicates.add(cb.isNotNull(root.get("bodyEn")));
                predicates.add(cb.notEqual(cb.trim(root.get("bodyEn")), ""));
            }
            jakarta.persistence.criteria.Expression<String> title = english
                    ? root.get("titleEn") : root.get("title");
            jakarta.persistence.criteria.Expression<String> excerpt = english
                    ? root.get("excerptEn") : root.get("excerpt");
            jakarta.persistence.criteria.Expression<String> body = english
                    ? root.get("bodyEn") : root.get("body");
            for (String token : tokens) {
                String like = "%" + token.toLowerCase(java.util.Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(title), like),
                        cb.like(cb.lower(cb.coalesce(excerpt, "")), like),
                        cb.like(cb.lower(cb.coalesce(body, "")), like)));
            }
            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };
        return articleJpaRepository
                .findAll(spec, org.springframework.data.domain.PageRequest.of(0, Math.min(3, limit)))
                .getContent().stream()
                .map(entity -> new ContentReadRepository.ArticleKnowledge(
                        english ? entity.getTitleEn() : entity.getTitle(),
                        english ? entity.getExcerptEn() : entity.getExcerpt(),
                        english ? entity.getBodyEn() : entity.getBody()))
                .toList();
    }

    // --- DB-paginated public listing ---

    @Override
    public org.springframework.data.domain.Page<Article> listPublishedArticles(
            String q, Boolean featured, Boolean homeExperience, Pageable pageable, String locale) {
        List<String> literalTerms = q == null ? List.of() : StorefrontSearchRules.literalTerms(q);
        org.springframework.data.domain.Page<ArticleEntity> entityPage = articleJpaRepository.findAll(
                storefrontArticleSpecification(literalTerms, featured, homeExperience, locale), pageable);
        return fetchAndOrderArticles(entityPage, pageable, locale);
    }

    // --- DB-paginated admin listing ---

    @Override
    public org.springframework.data.domain.Page<Article> listArticlesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable, String locale) {
        return articleJpaRepository.findAll(adminArticleSpecification(publishStatus, q), pageable)
                .map(entity -> toDomain(entity, locale, false));
    }

    // --- Non-paginated filter for admin combined listing ---

    @Override
    public List<Article> findArticlesByFilter(PublishStatus publishStatus, String q, String locale) {
        return articleJpaRepository.findAll(adminArticleSpecification(publishStatus, q))
                .stream()
                .map(e -> toDomain(e, locale, false)).toList();
    }

    /** Admin article search mirrors quick-search token and literal-wildcard rules. */
    private static org.springframework.data.jpa.domain.Specification<ArticleEntity> adminArticleSpecification(
            PublishStatus publishStatus, String rawQuery) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(publishStatus == null
                    ? cb.notEqual(root.get("publishStatus"), PublishStatus.TRASH)
                    : cb.equal(root.get("publishStatus"), publishStatus));

            for (String token : AdminSearchText.tokens(rawQuery)) {
                String pattern = AdminSearchText.likePattern(token);
                predicates.add(cb.or(
                        literalContains(cb, root.get("title"), pattern),
                        literalContains(cb, root.get("titleEn"), pattern),
                        literalContains(cb, root.get("slug"), pattern),
                        literalContains(cb, root.get("slugEn"), pattern),
                        literalContains(cb, root.get("excerpt"), pattern),
                        literalContains(cb, root.get("excerptEn"), pattern)
                ));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static Predicate literalContains(
            CriteriaBuilder cb, Expression<?> value, String pattern) {
        return cb.like(unaccentLower(cb, value), pattern, '\\');
    }

    private static Expression<String> unaccentLower(CriteriaBuilder cb, Expression<?> value) {
        return cb.function("unaccent", String.class, cb.lower(value.as(String.class)));
    }

    /** Customer article search: accent-insensitive and literal for SQL wildcard characters. */
    private static org.springframework.data.jpa.domain.Specification<ArticleEntity> storefrontArticleSpecification(
            List<String> literalTerms,
            Boolean featured,
            Boolean homeExperience,
            String locale
    ) {
        boolean english = "en".equalsIgnoreCase(locale);
        List<String> safeTerms = literalTerms == null ? List.of() : literalTerms;
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            if (featured != null) {
                predicates.add(cb.equal(root.get("featured"), featured));
            }
            if (homeExperience != null) {
                predicates.add(cb.equal(root.get("homeExperience"), homeExperience));
            }
            Expression<String> title = english
                    ? cb.<String>selectCase()
                            .when(cb.or(cb.isNull(root.get("titleEn")), cb.equal(cb.trim(root.get("titleEn")), "")), root.get("title"))
                            .otherwise(root.get("titleEn"))
                    : root.get("title");
            Expression<String> excerpt = english
                    ? cb.<String>selectCase()
                            .when(cb.or(cb.isNull(root.get("excerptEn")), cb.equal(cb.trim(root.get("excerptEn")), "")), root.get("excerpt"))
                            .otherwise(root.get("excerptEn"))
                    : root.get("excerpt");
            for (String term : safeTerms) {
                String pattern = StorefrontSearchRules.literalLikePattern(term);
                predicates.add(cb.or(
                        literalContains(cb, title, pattern),
                        literalContains(cb, cb.coalesce(excerpt, ""), pattern)));
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private static boolean isPresent(String value) {
        return value != null && !value.isBlank();
    }

    // --- Two-query helpers ---

    private org.springframework.data.domain.Page<Article> fetchAndOrderArticles(
            org.springframework.data.domain.Page<ArticleEntity> entityPage, Pageable pageable, String locale) {
        List<String> ids = entityPage.getContent().stream().map(ArticleEntity::getId).toList();
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, entityPage.getTotalElements());
        }
        List<ArticleEntity> entities = articleJpaRepository.findWithAssociationsByIdIn(ids);
        List<Article> ordered = orderByIds(entities, ids, ArticleEntity::getId)
                .stream().map(e -> toDomain(e, locale, false)).toList();
        return new PageImpl<>(ordered, pageable, entityPage.getTotalElements());
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

}
