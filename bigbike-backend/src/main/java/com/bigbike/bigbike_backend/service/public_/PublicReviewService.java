package com.bigbike.bigbike_backend.service.public_;

import com.bigbike.bigbike_backend.api.common.PaginationMeta;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.public_.dto.PublicProductReviewsResponse;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PublicReviewService {

    private static final String APPROVED_STATUS = "APPROVED";
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 50;
    private static final int DUPLICATE_WINDOW_HOURS = 24;
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;

    public PublicProductReviewsResponse getProductReviews(String productId, int page, int size) {
        if (!productRepo.existsById(productId)) {
            throw new NotFoundException("S\u1ea3n ph\u1ea9m kh\u00f4ng t\u1ed3n t\u1ea1i.");
        }

        int normalizedPage = Math.max(DEFAULT_PAGE, page);
        int normalizedSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        PageRequest pageRequest = PageRequest.of(
                normalizedPage - 1,
                normalizedSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        Page<ReviewEntity> approvedPage = reviewRepo.findByProductIdAndStatus(productId, APPROVED_STATUS, pageRequest);
        ReviewJpaRepository.ReviewAggregate aggregate =
                reviewRepo.findAggregateByProductIdAndStatus(productId, APPROVED_STATUS);

        double avgRating = roundAverage(aggregate.getAvgRating());
        long totalReviews = aggregate.getTotalReviews() != null ? aggregate.getTotalReviews() : 0L;

        List<PublicProductReviewsResponse.ReviewItem> reviews = approvedPage.getContent().stream()
                .map(this::toPublicReviewItem)
                .toList();

        PaginationMeta pagination = new PaginationMeta(
                normalizedPage,
                normalizedSize,
                totalReviews,
                approvedPage.getTotalPages(),
                approvedPage.hasNext(),
                approvedPage.hasPrevious());

        return new PublicProductReviewsResponse(avgRating, totalReviews, reviews, pagination);
    }

    @Transactional
    public void submitReview(String productId, String authorName, int rating, String comment) {
        productRepo.findById(productId)
                .orElseThrow(() -> new NotFoundException("S\u1ea3n ph\u1ea9m kh\u00f4ng t\u1ed3n t\u1ea1i."));

        String normalizedName = authorName.trim();
        String normalizedComment = comment != null ? comment.trim() : "";
        Instant now = Instant.now();

        // Duplicate guard: same productId + normalized(authorName) + normalized(body)
        // within the last 24 hours, regardless of rating or moderation status. We pull
        // the recent window for this product (small set in practice) and compare in
        // Java so the normalization rules (trim/lowercase/collapse whitespace) match
        // exactly between request and stored row, even when the row was inserted
        // before this guard existed.
        String dupKeyAuthor = normalizeForDup(normalizedName);
        String dupKeyComment = normalizeForDup(normalizedComment);
        Instant duplicateSince = now.minus(DUPLICATE_WINDOW_HOURS, ChronoUnit.HOURS);
        List<ReviewEntity> recent = reviewRepo.findRecentByProductId(productId, duplicateSince);
        boolean duplicate = recent.stream().anyMatch(r ->
                normalizeForDup(r.getAuthorName()).equals(dupKeyAuthor)
                        && normalizeForDup(r.getBody()).equals(dupKeyComment));
        if (duplicate) {
            throw new ConflictException(
                    "B\u1ea1n \u0111\u00e3 g\u1eedi \u0111\u00e1nh gi\u00e1 t\u01b0\u01a1ng t\u1ef1 g\u1ea7n \u0111\u00e2y. Vui l\u00f2ng ch\u1edd ki\u1ec3m duy\u1ec7t ho\u1eb7c ch\u1ec9nh s\u1eeda n\u1ed9i dung.");
        }

        ReviewEntity entity = new ReviewEntity();
        entity.setProductId(productId);
        entity.setAuthorName(normalizedName);
        entity.setRating((short) rating);
        entity.setBody(normalizedComment);
        entity.setStatus("PENDING");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        reviewRepo.save(entity);
    }

    private static String normalizeForDup(String value) {
        if (value == null) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        return WHITESPACE.matcher(trimmed.toLowerCase(Locale.ROOT)).replaceAll(" ");
    }

    private double roundAverage(Double avgRating) {
        if (avgRating == null) {
            return 0.0;
        }
        return Math.round(avgRating * 10.0) / 10.0;
    }

    private PublicProductReviewsResponse.ReviewItem toPublicReviewItem(ReviewEntity review) {
        return new PublicProductReviewsResponse.ReviewItem(
                review.getId(),
                review.getAuthorName() != null ? review.getAuthorName() : "\u1ea8n danh",
                review.getRating(),
                review.getBody() != null ? review.getBody() : "",
                review.getCreatedAt() != null ? review.getCreatedAt().toString() : "");
    }
}
