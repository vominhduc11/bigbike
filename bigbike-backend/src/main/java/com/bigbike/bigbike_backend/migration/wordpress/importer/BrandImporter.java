package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressBrandMapper.MappedBrand;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class BrandImporter implements DomainImporter {

    private final BrandJpaRepository repo;

    public BrandImporter(BrandJpaRepository repo) {
        this.repo = repo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.BRANDS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException(
                "BrandImporter.execute() requires pre-mapped data; use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedBrand> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedBrand mb : items) {
            if (mb.slug() == null || mb.slug().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<BrandEntity> existing = repo.findBySlug(mb.slug());
                BrandEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new BrandEntity();
                    entity.setId("wp-brand-" + mb.sourceId());
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSlug(mb.slug());
                entity.setName(mb.name() != null && !mb.name().isBlank() ? mb.name() : mb.slug());
                entity.setDescription(mb.description());
                entity.setVisible(true);
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mb.warnings());

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Brand slug=" + mb.slug() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.BRANDS, inserted, updated, skipped, failed, warnings, errors);
    }
}
