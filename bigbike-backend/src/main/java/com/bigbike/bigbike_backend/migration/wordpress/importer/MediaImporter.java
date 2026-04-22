package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressMediaMapper.MappedMedia;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import com.bigbike.bigbike_backend.persistence.repository.media.MediaJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class MediaImporter implements DomainImporter {

    private static final String STORAGE_PROVIDER = "LEGACY_WP";

    private final MediaJpaRepository repo;

    public MediaImporter(MediaJpaRepository repo) {
        this.repo = repo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.MEDIA;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedMedia> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedMedia mm : items) {
            if (mm.storagePath() == null || mm.storagePath().isBlank()) {
                skipped++;
                continue;
            }
            try {
                Optional<MediaEntity> existing = repo.findByLegacyId(mm.sourceId());
                MediaEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new MediaEntity();
                    entity.setId(UUID.randomUUID());
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setLegacyId(mm.sourceId());
                entity.setFilePath(mm.storagePath());
                entity.setMimeType(mm.mimeType());
                entity.setAltText(mm.altText());
                entity.setTitle(mm.title());
                entity.setWidth(mm.width());
                entity.setHeight(mm.height());
                entity.setSizes(mm.sizesJson());
                entity.setStorageProvider(STORAGE_PROVIDER);
                entity.setStatus(mm.status() != null ? mm.status() : "ACTIVE");
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mm.warnings());

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Media sourceId=" + mm.sourceId() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.MEDIA, inserted, updated, skipped, failed, warnings, errors);
    }
}
