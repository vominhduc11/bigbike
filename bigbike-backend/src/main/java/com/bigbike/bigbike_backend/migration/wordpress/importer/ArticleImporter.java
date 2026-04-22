package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressArticleMapper.MappedArticle;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.content.ArticleEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.ArticleJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ArticleImporter implements DomainImporter {

    private final ArticleJpaRepository repo;

    public ArticleImporter(ArticleJpaRepository repo) {
        this.repo = repo;
    }

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
            List<MappedArticle> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedArticle ma : items) {
            if (ma.slug() == null || ma.slug().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<ArticleEntity> existing = repo.findBySlug(ma.slug());
                ArticleEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new ArticleEntity();
                    entity.setId("wp-art-" + ma.sourceId());
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSlug(ma.slug());
                entity.setTitle(ma.title() != null && !ma.title().isBlank() ? ma.title() : ma.slug());
                entity.setExcerpt(ma.excerpt());
                entity.setBody(ma.content() != null ? ma.content() : "");
                entity.setPublishStatus(resolveStatus(ma.status()));
                entity.setSeoTitle(ma.seoTitle());
                entity.setSeoDescription(ma.seoDescription());
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(ma.warnings());

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Article slug=" + ma.slug() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.ARTICLES, inserted, updated, skipped, failed, warnings, errors);
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
