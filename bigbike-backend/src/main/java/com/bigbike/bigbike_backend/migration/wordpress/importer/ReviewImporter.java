package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressReviewMapper.MappedReview;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class ReviewImporter implements DomainImporter {

    private static final Logger log = LoggerFactory.getLogger(ReviewImporter.class);

    private final ReviewJpaRepository reviewRepo;

    public ReviewImporter(ReviewJpaRepository reviewRepo) {
        this.reviewRepo = reviewRepo;
    }

    @Override
    public MigrationDomain domain() {
        return MigrationDomain.PRODUCT_REVIEWS;
    }

    @Override
    public MigrationExecutionReport.DomainResult execute(MigrationExecutionOptions options) {
        throw new UnsupportedOperationException("Use importBatch()");
    }

    @Transactional
    public MigrationExecutionReport.DomainResult importBatch(
            List<MappedReview> items, MigrationExecutionOptions options) {

        int inserted = 0, updated = 0, skipped = 0, failed = 0;
        List<String> errors = new ArrayList<>();

        for (MappedReview mr : items) {
            // Product id is pre-resolved: WP-imported products always use "wp-prod-<postId>"
            String productId = "wp-prod-" + mr.wpProductPostId();
            try {
                Optional<ReviewEntity> existing = reviewRepo.findByLegacyId(mr.legacyId());
                ReviewEntity entity;
                boolean isNew;
                if (existing.isPresent()) {
                    entity = existing.get();
                    isNew = false;
                } else {
                    entity = new ReviewEntity();
                    entity.setLegacyId(mr.legacyId());
                    entity.setCreatedAt(mr.commentDateGmt() != null
                            ? mr.commentDateGmt().toInstant(ZoneOffset.UTC) : Instant.now());
                    isNew = true;
                }

                entity.setProductId(productId);
                entity.setAuthorName(mr.authorName());
                entity.setAuthorEmail(mr.authorEmail());
                entity.setRating(mr.rating());
                entity.setBody(mr.body());
                entity.setStatus(mr.status());
                entity.setUpdatedAt(Instant.now());

                if (!options.dryRun()) reviewRepo.save(entity);
                if (isNew) inserted++; else updated++;

            } catch (Exception e) {
                // FK violation: product not imported (e.g. draft/trash) — skip silently
                if (e.getMessage() != null && e.getMessage().contains("fk_reviews_product_id")) {
                    skipped++;
                    continue;
                }
                failed++;
                String msg = "Review legacyId=" + mr.legacyId() + ": " + e.getMessage();
                errors.add(msg);
                if (options.failFast()) throw new RuntimeException(msg, e);
            }
        }

        log.info("ReviewImporter: inserted={} updated={} skipped={} failed={}", inserted, updated, skipped, failed);
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCT_REVIEWS, inserted, updated, skipped, failed,
                List.of(), errors);
    }
}
