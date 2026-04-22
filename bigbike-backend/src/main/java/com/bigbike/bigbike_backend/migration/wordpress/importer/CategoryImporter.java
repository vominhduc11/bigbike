package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressCategoryMapper.MappedCategory;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
            List<MappedCategory> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedCategory mc : items) {
            if (mc.slug() == null || mc.slug().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<CategoryEntity> existing = repo.findBySlug(mc.slug());
                CategoryEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new CategoryEntity();
                    entity.setId("wp-cat-" + mc.sourceId());
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSlug(mc.slug());
                entity.setName(mc.name() != null && !mc.name().isBlank() ? mc.name() : mc.slug());
                entity.setDescription(mc.description());
                entity.setVisible(true);
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
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.CATEGORIES, inserted, updated, skipped, failed, warnings, errors);
    }
}
