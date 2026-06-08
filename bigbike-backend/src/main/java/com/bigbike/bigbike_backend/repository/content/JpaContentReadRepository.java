package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.ArticleTranslations;

import com.bigbike.bigbike_backend.domain.content.ContentCategorySummary;
import com.bigbike.bigbike_backend.domain.content.ContentCategoryWithCount;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.domain.content.PageTranslations;

import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
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
    private final PageJpaRepository pageJpaRepository;
    private final ContentCategoryJpaRepository contentCategoryJpaRepository;

    // --- Single-entity lookups ---

    @Override
    public Optional<Article> findArticleBySlug(String slug) {
        return articleJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Article> findArticleBySlug(String slug, String locale) {
        return articleJpaRepository.findBySlug(slug).map(e -> toDomain(e, locale));
    }

    @Override
    public Optional<Article> findArticleById(String id) {
        return articleJpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<Page> findPageBySlug(String slug) {
        return pageJpaRepository.findBySlug(slug).map(this::toDomain);
    }

    @Override
    public Optional<Page> findPageBySlug(String slug, String locale) {
        return pageJpaRepository.findBySlug(slug).map(e -> toDomain(e, locale));
    }

    @Override
    public Optional<Page> findPageById(String id) {
        return pageJpaRepository.findById(id).map(this::toDomain);
    }

    // --- Full-scan for GlobalSearchService ---

    @Override
    public List<Article> findAllArticles() {
        return articleJpaRepository.findAll().stream().map(e -> toDomain(e, "vi", false)).toList();
    }

    @Override
    public List<Article> searchPublishedArticles(java.util.List<String> tokens, int limit) {
        org.springframework.data.jpa.domain.Specification<ArticleEntity> spec = (root, query, cb) -> {
            java.util.List<jakarta.persistence.criteria.Predicate> preds = new java.util.ArrayList<>();
            preds.add(cb.equal(root.get("publishStatus"), PublishStatus.PUBLISHED));
            for (String token : tokens) {
                String like = "%" + token.toLowerCase(java.util.Locale.ROOT) + "%";
                preds.add(cb.or(
                        cb.like(cb.lower(root.get("title")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("excerpt"), "")), like)));
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
                .map(e -> toDomain(e, "vi", false))
                .toList();
    }

    // --- DB-paginated public listing ---

    @Override
    public org.springframework.data.domain.Page<Article> listPublishedArticles(
            String categorySlug, String q, Pageable pageable, String locale) {
        String normalizedQ = normalizeQuery(q);
        String normalizedCategory = (categorySlug != null && !categorySlug.isBlank()) ? categorySlug : null;

        org.springframework.data.domain.Page<String> idPage =
                articleJpaRepository.findPublishedArticleIds(
                        PublishStatus.PUBLISHED, normalizedCategory, normalizedQ, pageable);

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

    @Override
    public org.springframework.data.domain.Page<Page> listPagesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable, String locale) {
        String normalizedQ = normalizeQuery(q);

        org.springframework.data.domain.Page<String> idPage =
                pageJpaRepository.findAdminPageIds(publishStatus, normalizedQ, pageable);

        return fetchAndOrderPages(idPage, pageable, locale);
    }

    // --- Non-paginated filter for admin combined listing ---

    @Override
    public List<Article> findArticlesByFilter(PublishStatus publishStatus, String q, String locale) {
        return articleJpaRepository.findByFilter(publishStatus, normalizeQuery(q))
                .stream().map(e -> toDomain(e, locale, false)).toList();
    }

    @Override
    public List<Page> findPagesByFilter(PublishStatus publishStatus, String q, String locale) {
        return pageJpaRepository.findByFilter(publishStatus, normalizeQuery(q))
                .stream().map(e -> toDomain(e, locale, false)).toList();
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

    private org.springframework.data.domain.Page<Page> fetchAndOrderPages(
            org.springframework.data.domain.Page<String> idPage, Pageable pageable, String locale) {
        List<String> ids = idPage.getContent();
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, idPage.getTotalElements());
        }
        List<PageEntity> entities = pageJpaRepository.findWithParentByIdIn(ids);
        List<Page> ordered = orderByIds(entities, ids, PageEntity::getId)
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
        return new Article(
                entity.getId(),
                entity.getSlug(),
                pick(entity.getTitle(), entity.getTitleEn(), locale),
                pick(entity.getExcerpt(), entity.getExcerptEn(), locale),
                pick(entity.getBody(), entity.getBodyEn(), locale),
                toImageAsset(
                        entity.getCoverImageId(),
                        entity.getCoverImageUrl(),
                        entity.getCoverImageAlt(),
                        entity.getCoverImageWidth(),
                        entity.getCoverImageHeight(),
                        entity.getCoverImageMimeType()
                ),
                toCategorySummary(entity),
                toCategorySummaries(entity),
                entity.getPublishStatus(),
                toSeoMeta(
                        pick(entity.getSeoTitle(), entity.getSeoTitleEn(), locale),
                        pick(entity.getSeoDescription(), entity.getSeoDescriptionEn(), locale),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType()
                ),
                includeTranslations ? toArticleTranslations(entity) : null,
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                includeTranslations ? entity.getBodyBlocks() : null
        );
    }

    private Page toDomain(PageEntity entity) {
        return toDomain(entity, "vi", true);
    }

    private Page toDomain(PageEntity entity, String locale) {
        return toDomain(entity, locale, false);
    }

    private Page toDomain(PageEntity entity, String locale, boolean includeTranslations) {
        return new Page(
                entity.getId(),
                entity.getSlug(),
                pick(entity.getTitle(), entity.getTitleEn(), locale),
                pick(entity.getBody(), entity.getBodyEn(), locale),
                entity.getPageType(),
                entity.getParent() != null ? entity.getParent().getId() : null,
                entity.getPublishStatus(),
                toSeoMeta(
                        pick(entity.getSeoTitle(), entity.getSeoTitleEn(), locale),
                        pick(entity.getSeoDescription(), entity.getSeoDescriptionEn(), locale),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType()
                ),
                entity.getHeroImageUrl(),
                entity.getHeroImageAlt(),
                pick(entity.getHeroTitle(), entity.getHeroTitleEn(), locale),
                pick(entity.getHeroDescription(), entity.getHeroDescriptionEn(), locale),
                pick(entity.getHeroKicker(), entity.getHeroKickerEn(), locale),
                includeTranslations ? toPageTranslations(entity) : null,
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                includeTranslations ? entity.getBodyBlocks() : null
        );
    }

    private ContentCategorySummary toCategorySummary(ContentCategoryEntity entity) {
        if (entity == null) {
            return null;
        }
        return new ContentCategorySummary(entity.getId(), entity.getSlug(), entity.getName());
    }

    private ContentCategorySummary toCategorySummary(ArticleEntity entity) {
        if (entity.getCategory() != null) {
            return toCategorySummary(entity.getCategory());
        }
        if (entity.getCategories() != null && !entity.getCategories().isEmpty()) {
            return toCategorySummary(entity.getCategories().get(0));
        }
        return null;
    }

    private List<ContentCategorySummary> toCategorySummaries(ArticleEntity entity) {
        if (entity.getCategories() == null || entity.getCategories().isEmpty()) {
            ContentCategorySummary primary = toCategorySummary(entity.getCategory());
            return primary == null ? List.of() : List.of(primary);
        }
        return entity.getCategories().stream()
                .filter(Objects::nonNull)
                .map(this::toCategorySummary)
                .filter(Objects::nonNull)
                .toList();
    }

    private static ImageAsset toImageAsset(
            String id, String url, String alt, Integer width, Integer height, String mimeType) {
        if (url == null || url.isBlank()) {
            return null;
        }
        return new ImageAsset(id, url, alt, width, height, mimeType);
    }

    private static SeoMeta toSeoMeta(
            String title, String description, String canonicalUrl,
            String ogImageId, String ogImageUrl, String ogImageAlt,
            Integer ogImageWidth, Integer ogImageHeight, String ogImageMimeType) {
        if ((title == null || title.isBlank())
                && (description == null || description.isBlank())
                && (canonicalUrl == null || canonicalUrl.isBlank())
                && (ogImageUrl == null || ogImageUrl.isBlank())) {
            return null;
        }
        return new SeoMeta(
                title, description, canonicalUrl,
                toImageAsset(ogImageId, ogImageUrl, ogImageAlt, ogImageWidth, ogImageHeight, ogImageMimeType));
    }

    private static String normalizeQuery(String q) {
        return (q != null && !q.isBlank()) ? q.trim() : null;
    }

    private static String pick(String base, String en, String locale) {
        return "en".equals(locale) && en != null && !en.isBlank() ? en : base;
    }

    private static ArticleTranslations toArticleTranslations(ArticleEntity entity) {
        return new ArticleTranslations(
                new ArticleTranslations.ArticleContent(
                        entity.getTitleEn(),
                        entity.getExcerptEn(),
                        entity.getBodyEn(),
                        entity.getSeoTitleEn(),
                        entity.getSeoDescriptionEn()
                )
        );
    }

    private static PageTranslations toPageTranslations(PageEntity entity) {
        return new PageTranslations(
                new PageTranslations.PageContent(
                        entity.getTitleEn(),
                        entity.getBodyEn(),
                        entity.getHeroTitleEn(),
                        entity.getHeroDescriptionEn(),
                        entity.getHeroKickerEn(),
                        entity.getSeoTitleEn(),
                        entity.getSeoDescriptionEn()
                )
        );
    }
}
