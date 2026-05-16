package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.catalog.SeoMeta;
import com.bigbike.bigbike_backend.domain.content.Article;
import com.bigbike.bigbike_backend.domain.content.AuthorSummary;
import com.bigbike.bigbike_backend.domain.content.ContentCategorySummary;
import com.bigbike.bigbike_backend.domain.content.Page;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.BlogTagEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentAuthorEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
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

    // --- Single-entity lookups ---

    @Override
    public Optional<Article> findArticleBySlug(String slug) {
        return articleJpaRepository.findBySlug(slug).map(this::toDomain);
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
    public Optional<Page> findPageById(String id) {
        return pageJpaRepository.findById(id).map(this::toDomain);
    }

    // --- Full-scan for GlobalSearchService ---

    @Override
    public List<Article> findAllArticles() {
        return articleJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    // --- DB-paginated public listing ---

    @Override
    public org.springframework.data.domain.Page<Article> listPublishedArticles(
            String categorySlug, String q, Pageable pageable) {
        String normalizedQ = normalizeQuery(q);
        String normalizedCategory = (categorySlug != null && !categorySlug.isBlank()) ? categorySlug : null;

        org.springframework.data.domain.Page<String> idPage =
                articleJpaRepository.findPublishedArticleIds(
                        PublishStatus.PUBLISHED, normalizedCategory, normalizedQ, pageable);

        return fetchAndOrderArticles(idPage, pageable);
    }

    // --- DB-paginated admin listing ---

    @Override
    public org.springframework.data.domain.Page<Article> listArticlesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable) {
        String normalizedQ = normalizeQuery(q);

        org.springframework.data.domain.Page<String> idPage =
                articleJpaRepository.findAdminArticleIds(publishStatus, normalizedQ, pageable);

        return fetchAndOrderArticles(idPage, pageable);
    }

    @Override
    public org.springframework.data.domain.Page<Page> listPagesAdmin(
            PublishStatus publishStatus, String q, Pageable pageable) {
        String normalizedQ = normalizeQuery(q);

        org.springframework.data.domain.Page<String> idPage =
                pageJpaRepository.findAdminPageIds(publishStatus, normalizedQ, pageable);

        return fetchAndOrderPages(idPage, pageable);
    }

    // --- Non-paginated filter for admin combined listing ---

    @Override
    public List<Article> findArticlesByFilter(PublishStatus publishStatus, String q) {
        return articleJpaRepository.findByFilter(publishStatus, normalizeQuery(q))
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<Page> findPagesByFilter(PublishStatus publishStatus, String q) {
        return pageJpaRepository.findByFilter(publishStatus, normalizeQuery(q))
                .stream().map(this::toDomain).toList();
    }

    // --- Two-query helpers ---

    private org.springframework.data.domain.Page<Article> fetchAndOrderArticles(
            org.springframework.data.domain.Page<String> idPage, Pageable pageable) {
        List<String> ids = idPage.getContent();
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, idPage.getTotalElements());
        }
        List<ArticleEntity> entities = articleJpaRepository.findWithAssociationsByIdIn(ids);
        List<Article> ordered = orderByIds(entities, ids, ArticleEntity::getId)
                .stream().map(this::toDomain).toList();
        return new PageImpl<>(ordered, pageable, idPage.getTotalElements());
    }

    private org.springframework.data.domain.Page<Page> fetchAndOrderPages(
            org.springframework.data.domain.Page<String> idPage, Pageable pageable) {
        List<String> ids = idPage.getContent();
        if (ids.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, idPage.getTotalElements());
        }
        List<PageEntity> entities = pageJpaRepository.findWithParentByIdIn(ids);
        List<Page> ordered = orderByIds(entities, ids, PageEntity::getId)
                .stream().map(this::toDomain).toList();
        return new PageImpl<>(ordered, pageable, idPage.getTotalElements());
    }

    private static <E> List<E> orderByIds(List<E> entities, List<String> ids, java.util.function.Function<E, String> idExtractor) {
        Map<String, E> byId = entities.stream()
                .collect(Collectors.toMap(idExtractor, e -> e, (a, b) -> a, LinkedHashMap::new));
        return ids.stream().map(byId::get).filter(Objects::nonNull).toList();
    }

    // --- Entity → domain mappers ---

    private Article toDomain(ArticleEntity entity) {
        return new Article(
                entity.getId(),
                entity.getSlug(),
                entity.getTitle(),
                entity.getExcerpt(),
                entity.getBody(),
                toImageAsset(
                        entity.getCoverImageId(),
                        entity.getCoverImageUrl(),
                        entity.getCoverImageAlt(),
                        entity.getCoverImageWidth(),
                        entity.getCoverImageHeight(),
                        entity.getCoverImageMimeType()
                ),
                toImageAsset(null, entity.getProductImageUrl(), entity.getProductImageAlt(), null, null, null),
                toAuthorSummary(entity.getAuthor()),
                toCategorySummary(entity),
                toCategorySummaries(entity),
                entity.getTags() == null ? List.of() : entity.getTags().stream()
                        .map(BlogTagEntity::getName)
                        .filter(Objects::nonNull)
                        .toList(),
                entity.getPublishStatus(),
                toSeoMeta(
                        entity.getSeoTitle(),
                        entity.getSeoDescription(),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType(),
                        entity.getSeoNoIndex()
                ),
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private Page toDomain(PageEntity entity) {
        return new Page(
                entity.getId(),
                entity.getSlug(),
                entity.getTitle(),
                entity.getBody(),
                entity.getPageType(),
                entity.getParent() != null ? entity.getParent().getId() : null,
                entity.getPublishStatus(),
                toSeoMeta(
                        entity.getSeoTitle(),
                        entity.getSeoDescription(),
                        entity.getSeoCanonicalUrl(),
                        entity.getSeoOgImageId(),
                        entity.getSeoOgImageUrl(),
                        entity.getSeoOgImageAlt(),
                        entity.getSeoOgImageWidth(),
                        entity.getSeoOgImageHeight(),
                        entity.getSeoOgImageMimeType(),
                        entity.getSeoNoIndex()
                ),
                entity.getHeroImageUrl(),
                entity.getHeroImageAlt(),
                entity.getHeroTitle(),
                entity.getHeroDescription(),
                entity.getHeroKicker(),
                entity.getPublishedAt(),
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }

    private AuthorSummary toAuthorSummary(ContentAuthorEntity entity) {
        if (entity == null) {
            return null;
        }
        return new AuthorSummary(entity.getId(), entity.getName());
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
            Integer ogImageWidth, Integer ogImageHeight, String ogImageMimeType,
            Boolean noIndex) {
        if ((title == null || title.isBlank())
                && (description == null || description.isBlank())
                && (canonicalUrl == null || canonicalUrl.isBlank())
                && (ogImageUrl == null || ogImageUrl.isBlank())
                && noIndex == null) {
            return null;
        }
        return new SeoMeta(
                title, description, canonicalUrl,
                toImageAsset(ogImageId, ogImageUrl, ogImageAlt, ogImageWidth, ogImageHeight, ogImageMimeType),
                noIndex);
    }

    private static String normalizeQuery(String q) {
        return (q != null && !q.isBlank()) ? q.trim() : null;
    }
}
