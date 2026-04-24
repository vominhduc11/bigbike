package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.content.PageType;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressPageMapper.MappedPage;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.content.PageEntity;
import com.bigbike.bigbike_backend.persistence.repository.content.PageJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class PageImporter implements DomainImporter {

    private final PageJpaRepository repo;

    public PageImporter(PageJpaRepository repo) {
        this.repo = repo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PAGES;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedPage> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedPage mp : items) {
            try {
                String slug = resolveSlug(mp);
                String entityId = "wp-page-" + mp.sourceId();
                Optional<PageEntity> existing = repo.findById(entityId);
                PageEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new PageEntity();
                    entity.setId(entityId);
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSlug(slug);
                entity.setTitle(resolveTitle(mp, slug));
                entity.setBody(mp.content() != null ? mp.content() : "");
                entity.setPageType(resolvePageType(slug));
                entity.setPublishStatus(resolveStatus(mp.status()));
                entity.setSeoTitle(mp.seoTitle());
                entity.setSeoDescription(mp.seoDescription());
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mp.warnings());

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Page slug=" + mp.slug() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }

        if (!options.dryRun()) {
            for (MappedPage mp : items) {
                if (mp.parentSourceId() == null || mp.parentSourceId() <= 0) {
                    continue;
                }
                repo.findBySlug(mp.slug()).ifPresent(entity -> {
                    PageEntity parent = repo.findById("wp-page-" + mp.parentSourceId()).orElse(null);
                    if (parent != null) {
                        entity.setParent(parent);
                        entity.setUpdatedAt(Instant.now());
                        repo.save(entity);
                    }
                });
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PAGES, inserted, updated, skipped, failed, warnings, errors);
    }

    private String resolveSlug(MappedPage page) {
        if (page.slug() != null && !page.slug().isBlank()) {
            return page.slug();
        }
        return "page-" + page.sourceId();
    }

    private String resolveTitle(MappedPage page, String fallbackSlug) {
        if (page.title() != null && !page.title().isBlank()) {
            return page.title();
        }
        return fallbackSlug;
    }

    private PageType resolvePageType(String slug) {
        if (slug == null) return PageType.CUSTOM;
        return switch (slug) {
            case "gioi-thieu", "about" -> PageType.ABOUT;
            case "lien-he", "contact" -> PageType.CONTACT;
            case "chinh-sach", "policy", "chinh-sach-bao-mat", "chinh-sach-doi-tra" -> PageType.POLICY;
            case "huong-dan", "help", "faq" -> PageType.HELP;
            default -> PageType.CUSTOM;
        };
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
