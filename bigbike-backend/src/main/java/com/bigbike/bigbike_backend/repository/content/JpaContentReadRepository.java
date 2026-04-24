package com.bigbike.bigbike_backend.repository.content;

import com.bigbike.bigbike_backend.domain.catalog.ImageAsset;
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
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
@Primary
@Profile("!mock")
@Transactional(readOnly = true)
public class JpaContentReadRepository implements ContentReadRepository {

    private final ArticleJpaRepository articleJpaRepository;
    private final PageJpaRepository pageJpaRepository;

    public JpaContentReadRepository(ArticleJpaRepository articleJpaRepository, PageJpaRepository pageJpaRepository) {
        this.articleJpaRepository = articleJpaRepository;
        this.pageJpaRepository = pageJpaRepository;
    }

    @Override
    public List<Article> findAllArticles() {
        return articleJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

    @Override
    public List<Page> findAllPages() {
        return pageJpaRepository.findAll().stream().map(this::toDomain).toList();
    }

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
                toAuthorSummary(entity.getAuthor()),
                toCategorySummary(entity),
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

    private static ImageAsset toImageAsset(
            String id,
            String url,
            String alt,
            Integer width,
            Integer height,
            String mimeType
    ) {
        if (url == null || url.isBlank()) {
            return null;
        }
        return new ImageAsset(id, url, alt, width, height, mimeType);
    }

    private static SeoMeta toSeoMeta(
            String title,
            String description,
            String canonicalUrl,
            String ogImageId,
            String ogImageUrl,
            String ogImageAlt,
            Integer ogImageWidth,
            Integer ogImageHeight,
            String ogImageMimeType,
            Boolean noIndex
    ) {
        if ((title == null || title.isBlank())
                && (description == null || description.isBlank())
                && (canonicalUrl == null || canonicalUrl.isBlank())
                && (ogImageUrl == null || ogImageUrl.isBlank())
                && noIndex == null) {
            return null;
        }

        return new SeoMeta(
                title,
                description,
                canonicalUrl,
                toImageAsset(ogImageId, ogImageUrl, ogImageAlt, ogImageWidth, ogImageHeight, ogImageMimeType),
                noIndex
        );
    }
}
