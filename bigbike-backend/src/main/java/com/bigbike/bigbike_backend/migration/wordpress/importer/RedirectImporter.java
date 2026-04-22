package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressRedirectMapper.MappedRedirect;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import com.bigbike.bigbike_backend.persistence.repository.redirect.RedirectJpaRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class RedirectImporter implements DomainImporter {

    private final RedirectJpaRepository repo;

    public RedirectImporter(RedirectJpaRepository repo) {
        this.repo = repo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.REDIRECTS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedRedirect> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> warnings = new ArrayList<>();
        List<String> errors = new ArrayList<>();

        for (MappedRedirect mr : items) {
            if (mr.sourcePattern() == null || mr.sourcePattern().isBlank()
                    || mr.targetPattern() == null || mr.targetPattern().isBlank()) {
                skipped++;
                continue;
            }
            if (mr.sourcePattern().equals(mr.targetPattern())) {
                warnings.add("Skipping self-loop redirect: " + mr.sourcePattern());
                skipped++;
                continue;
            }
            try {
                Optional<RedirectEntity> existing = repo.findBySourcePattern(mr.sourcePattern());
                RedirectEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new RedirectEntity();
                    entity.setCreatedAt(Instant.now());
                    isNew = true;
                }
                entity.setSourcePattern(mr.sourcePattern());
                entity.setTargetUrl(mr.targetPattern());
                entity.setStatusCode(mr.redirectCode() > 0 ? mr.redirectCode() : 301);
                entity.setRedirectType("PERMANENT");
                entity.setEnabled(mr.enabled());
                entity.setLegacyId(mr.sourceId());
                entity.setUpdatedAt(Instant.now());
                warnings.addAll(mr.warnings());

                if (!options.dryRun()) {
                    repo.save(entity);
                }
                if (isNew) inserted++; else updated++;
            } catch (Exception e) {
                failed++;
                errors.add("Redirect src=" + mr.sourcePattern() + ": " + e.getMessage());
                if (options.failFast()) throw new RuntimeException(errors.get(errors.size() - 1), e);
            }
        }
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.REDIRECTS, inserted, updated, skipped, failed, warnings, errors);
    }
}
