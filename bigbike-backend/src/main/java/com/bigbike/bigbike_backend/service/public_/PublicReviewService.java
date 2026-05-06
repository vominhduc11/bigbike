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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicReviewService {

    private static final String APPROVED_STATUS = "APPROVED";
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 50;

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;

    public PublicReviewService(ReviewJpaRepository reviewRepo, ProductJpaRepository productRepo) {
        this.reviewRepo = reviewRepo;
        this.productRepo = productRepo;
    }

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

        long dupeCount = reviewRepo.countDuplicate(
                productId, normalizedName, (short) rating, normalizedComment,
                now.minus(30, ChronoUnit.MINUTES));
        if (dupeCount > 0) {
            throw new ConflictException(
                    "\u0110\u00e1nh gi\u00e1 t\u01b0\u01a1ng t\u1ef1 v\u1eeba \u0111\u01b0\u1ee3c g\u1eedi. Vui l\u00f2ng th\u1eed l\u1ea1i sau.");
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
