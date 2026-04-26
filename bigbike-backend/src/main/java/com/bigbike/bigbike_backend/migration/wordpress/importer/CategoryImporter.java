package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCategoryMapper.MappedCategory;
import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper.MappedMedia;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class CategoryImporter implements DomainImporter {

    private final CategoryJpaRepository repo;

    public CategoryImporter(CategoryJpaRepository repo) {
        this.repo = repo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.CATEGORIES;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException(
                "CategoryImporter.execute() requires pre-mapped data; use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedCategory> items,
            MigrationExecutionOptions options,
            Map<Long, MappedMedia> mediaByLegacyId,
            String mediaPublicBaseUrl) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedCategory mc : items) {
            if (mc.slug() == null || mc.slug().isBlank()) {
                skipped++;
                continue;
            }
            try {
                String entityId = "wp-cat-" + mc.sourceId();
                Optional<CategoryEntity> existing = repo.findById(entityId);
                CategoryEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new CategoryEntity();
                    entity.setId(entityId);
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSlug(mc.slug());
                entity.setName(mc.name() != null && !mc.name().isBlank() ? mc.name() : mc.slug());
                entity.setDescription(mc.description());
                entity.setVisible(true);
                entity.setShowOnHomepage(mc.showOnHomepage());
                entity.setSortOrder(mc.sortOrder());

                // Thumbnail image — resolved from WP termmeta thumbnail_id via mediaByLegacyId map
                if (mc.thumbnailId() != null && mediaByLegacyId != null) {
                    MappedMedia thumb = mediaByLegacyId.get(mc.thumbnailId());
                    if (thumb != null && thumb.storagePath() != null && !thumb.storagePath().isBlank()) {
                        String base = mediaPublicBaseUrl == null ? "" :
                                (mediaPublicBaseUrl.endsWith("/")
                                        ? mediaPublicBaseUrl.substring(0, mediaPublicBaseUrl.length() - 1)
                                        : mediaPublicBaseUrl);
                        String storagePath = thumb.storagePath().startsWith("/")
                                ? thumb.storagePath().substring(1)
                                : thumb.storagePath();
                        entity.setImageId(String.valueOf(mc.thumbnailId()));
                        entity.setImageUrl(base + "/wp-uploads/" + storagePath);
                        entity.setImageAlt(thumb.altText());
                        entity.setImageWidth(thumb.width());
                        entity.setImageHeight(thumb.height());
                        entity.setImageMimeType(thumb.mimeType());
                    } else {
                        warnings.add("Category slug=" + mc.slug()
                                + ": thumbnail_id=" + mc.thumbnailId() + " not found in media map");
                    }
                }

                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mc.warnings());

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Category slug=" + mc.slug() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }

        if (!options.dryRun()) {
            for (MappedCategory mc : items) {
                if (mc.slug() == null || mc.slug().isBlank() || mc.parentTermId() == null || mc.parentTermId() <= 0) {
                    continue;
                }
                repo.findBySlug(mc.slug()).ifPresent(entity -> {
                    CategoryEntity parent = repo.findById("wp-cat-" + mc.parentTermId()).orElse(null);
                    if (parent != null) {
                        entity.setParent(parent);
                        entity.setUpdatedAt(Instant.now());
                        repo.save(entity);
                    }
                });
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.CATEGORIES, inserted, updated, skipped, failed, warnings, errors);
    }
}
