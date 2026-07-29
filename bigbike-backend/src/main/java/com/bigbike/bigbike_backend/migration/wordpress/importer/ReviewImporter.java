package com.bigbike.bigbike_backend.migration.wordpress.importer;

import com.bigbike.bigbike_backend.migration.wordpress.mapper.WordPressReviewMapper.MappedReview;
import com.bigbike.bigbike_backend.migration.wordpress.writeplan.MigrationDomain;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Slf4j
@RequiredArgsConstructor
public class ReviewImporter implements DomainImporter {

    private static final String APPROVED_STATUS = "APPROVED";

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;

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
        // Sản phẩm có review được import trong batch này → cần recompute cache rating.
        Set<String> affectedProductIds = new LinkedHashSet<>();

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
                entity.setRating(BigDecimal.valueOf(mr.rating()));
                entity.setBody(mr.body());
                entity.setStatus(mr.status());
                entity.setUpdatedAt(Instant.now());
                if (APPROVED_STATUS.equals(mr.status()) && entity.getFirstApprovedAt() == null) {
                    entity.setFirstApprovedAt(entity.getCreatedAt());
                }

                if (!options.dryRun()) reviewRepo.save(entity);
                if (isNew) inserted++; else updated++;
                affectedProductIds.add(productId);

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

        // REVIEW_RULE_004: import xong recompute cache rating/rating_count từ review
        // ĐÃ DUYỆT cho từng sản phẩm bị chạm — nguồn chân lý duy nhất là review
        // APPROVED, không phải meta sản phẩm WP. Bỏ qua khi dry-run (review chưa ghi).
        if (!options.dryRun()) {
            for (String productId : affectedProductIds) {
                recomputeRatingCache(productId);
            }
        }

        log.info("ReviewImporter: inserted={} updated={} skipped={} failed={} ratingRecomputed={}",
                inserted, updated, skipped, failed, options.dryRun() ? 0 : affectedProductIds.size());
        return new MigrationExecutionReport.DomainResult(
                MigrationDomain.PRODUCT_REVIEWS, inserted, updated, skipped, failed,
                List.of(), errors);
    }

    /**
     * Recompute cache {@code products.rating} / {@code products.rating_count} từ
     * review APPROVED của sản phẩm. Mirror {@code AdminReviewService.toCachedRating}
     * (REVIEW_RULE_002: trung bình cộng, làm tròn 1 chữ số HALF_UP). 0 review duyệt
     * → rating = NULL, rating_count = 0. Entity managed trong transaction nên
     * dirty-checking tự flush; aggregate query thấy review vừa ghi (flush AUTO).
     */
    private void recomputeRatingCache(String productId) {
        productRepo.findById(productId).ifPresent(product -> {
            ReviewJpaRepository.ReviewAggregate agg =
                    reviewRepo.findAggregateByProductIdAndStatus(productId, APPROVED_STATUS);
            int total = agg.getTotalReviews() != null ? Math.toIntExact(agg.getTotalReviews()) : 0;
            product.setRating(total > 0 && agg.getAvgRating() != null
                    ? BigDecimal.valueOf(agg.getAvgRating()).setScale(1, RoundingMode.HALF_UP)
                    : null);
            product.setRatingCount(total);
        });
    }
}
