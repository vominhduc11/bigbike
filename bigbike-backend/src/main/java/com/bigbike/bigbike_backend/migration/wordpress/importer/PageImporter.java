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
            if (mp.slug() == null || mp.slug().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<PageEntity> existing = repo.findBySlug(mp.slug());
                PageEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new PageEntity();
                    entity.setId("wp-page-" + mp.sourceId());
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSlug(mp.slug());
                entity.setTitle(mp.title() != null && !mp.title().isBlank() ? mp.title() : mp.slug());
                entity.setBody(mp.content() != null ? mp.content() : "");
                entity.setPageType(resolvePageType(mp.slug()));
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
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PAGES, inserted, updated, skipped, failed, warnings, errors);
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
