package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper.MappedArticle;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper.MappedMedia;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.BlogTagEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentAuthorEntity;
import com.bigbike.bigbike_backend.persistence.entity.content.ContentCategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.BlogTagJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentAuthorJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.content.ContentCategoryJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@RequiredArgsConstructor
public class ArticleImporter implements DomainImporter {

    private final ArticleJpaRepository repo;
    private final ContentAuthorJpaRepository authorRepo;
    private final ContentCategoryJpaRepository categoryRepo;
    private final BlogTagJpaRepository blogTagRepo;

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.ARTICLES;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedArticle> items,
            MigrationExecutionOptions options,
            Map<Long, MappedMedia> mediaByLegacyId,
            String mediaPublicBaseUrl) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedArticle ma : items) {
            try {
                String slug = resolveSlug(ma);
                String entityId = "wp-art-" + ma.sourceId();
                Optional<ArticleEntity> existing = repo.findById(entityId);
                ArticleEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new ArticleEntity();
                    entity.setId(entityId);
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }

                ContentAuthorEntity author = resolveAuthor(ma, options.dryRun());
                List<ContentCategoryEntity> categories = resolveCategories(ma, options.dryRun());
                List<BlogTagEntity> tags = resolveTags(ma, options.dryRun());

                entity.setSlug(slug);
                entity.setTitle(resolveTitle(ma, slug));
                entity.setExcerpt(ma.excerpt());
                entity.setBody(ma.content() != null ? ma.content() : "");
                entity.setAuthor(author);
                entity.setCategory(categories.isEmpty() ? null : categories.get(0));
                entity.setCategories(categories);
                entity.setTags(tags);
                entity.setPublishStatus(resolveStatus(ma.status()));
                entity.setSeoTitle(ma.seoTitle());
                entity.setSeoDescription(ma.seoDescription());
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(ma.warnings());

                if (ma.thumbnailId() != null) {
                    MappedMedia thumb = mediaByLegacyId.get(ma.thumbnailId());
                    if (thumb != null && thumb.storagePath() != null && !thumb.storagePath().isBlank()) {
                        String base = mediaPublicBaseUrl.endsWith("/")
                                ? mediaPublicBaseUrl.substring(0, mediaPublicBaseUrl.length() - 1)
                                : mediaPublicBaseUrl;
                        String storagePath = thumb.storagePath().startsWith("/")
                                ? thumb.storagePath().substring(1)
                                : thumb.storagePath();
                        entity.setCoverImageId(String.valueOf(ma.thumbnailId()));
                        entity.setCoverImageUrl(base + "/wp-uploads/" + storagePath);
                        entity.setCoverImageAlt(thumb.altText());
                        entity.setCoverImageWidth(thumb.width());
                        entity.setCoverImageHeight(thumb.height());
                        entity.setCoverImageMimeType(thumb.mimeType());
                    }
                }

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Article slug=" + ma.slug() + ": " + e.getMessage());
                if (options.failFast()) {
                    throw new RuntimeException(errors.get(errors.size() - 1), e);
                }
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.ARTICLES, inserted, updated, skipped, failed, warnings, errors);
    }

    private String resolveSlug(MappedArticle article) {
        if (article.slug() != null && !article.slug().isBlank()) {
            return article.slug();
        }
        return "article-" + article.sourceId();
    }

    private String resolveTitle(MappedArticle article, String fallbackSlug) {
        if (article.title() != null && !article.title().isBlank()) {
            return article.title();
        }
        return fallbackSlug;
    }

    private ContentAuthorEntity resolveAuthor(MappedArticle article, boolean dryRun) {
        String authorId = "wp-author-" + article.authorSourceId();
        return authorRepo.findById(authorId).orElseGet(() -> {
            ContentAuthorEntity entity = new ContentAuthorEntity();
            entity.setId(authorId);
            entity.setName(article.authorName() == null || article.authorName().isBlank()
                    ? "Author " + article.authorSourceId()
                    : article.authorName());
            return dryRun ? entity : authorRepo.save(entity);
        });
    }

    private List<ContentCategoryEntity> resolveCategories(MappedArticle article, boolean dryRun) {
        if (article.categories() == null || article.categories().isEmpty()) {
            return new ArrayList<>();
        }
        List<ContentCategoryEntity> resolved = new ArrayList<>();
        for (TaxonomyRef ref : article.categories()) {
            String id = "wp-blog-cat-" + ref.sourceId();
            ContentCategoryEntity entity = categoryRepo.findBySlug(ref.slug()).orElseGet(() -> categoryRepo.findById(id).orElseGet(() -> {
                ContentCategoryEntity created = new ContentCategoryEntity();
                created.setId(id);
                created.setSlug(ref.slug());
                created.setName(ref.name());
                return dryRun ? created : categoryRepo.save(created);
            }));
            resolved.add(entity);
        }
        return resolved;
    }

    private List<BlogTagEntity> resolveTags(MappedArticle article, boolean dryRun) {
        if (article.tags() == null || article.tags().isEmpty()) {
            return new ArrayList<>();
        }
        List<BlogTagEntity> resolved = new ArrayList<>();
        for (TaxonomyRef ref : article.tags()) {
            String id = "wp-blog-tag-" + ref.sourceId();
            BlogTagEntity entity = blogTagRepo.findBySlug(ref.slug()).orElseGet(() -> blogTagRepo.findById(id).orElseGet(() -> {
                BlogTagEntity created = new BlogTagEntity();
                created.setId(id);
                created.setSlug(ref.slug());
                created.setName(ref.name());
                return dryRun ? created : blogTagRepo.save(created);
            }));
            resolved.add(entity);
        }
        return resolved;
    }

    private PublishStatus resolveStatus(String status) {
        if (status == null) return PublishStatus.DRAFT;
        return switch (status.toUpperCase()) {
            case "PUBLISHED", "ACTIVE" -> PublishStatus.PUBLISHED;
            case "ARCHIVED" -> PublishStatus.ARCHIVED;
            default -> PublishStatus.DRAFT;
        };
    }
}
