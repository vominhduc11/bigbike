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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class PublicReviewService {

    private static final String APPROVED_STATUS = "APPROVED";
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 50;
    private static final int DUPLICATE_WINDOW_HOURS = 24;
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private static final int MAX_PHOTOS = 10;

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;
    private final ReviewPhotoStorageService reviewPhotoStorageService;

    public PublicProductReviewsResponse getProductReviews(String productId, int page, int size) {
        return getProductReviews(productId, page, size, null, null);
    }

    /**
     * @param rating optional star filter (1..5); {@code null} returns every approved review.
     * @param sort   ordering key: {@code newest} (default), {@code highest}, {@code lowest}.
     *               The rating filter narrows only the list \u2014 avgRating, totalReviews and the
     *               ratingBreakdown histogram always reflect every approved review so the summary
     *               panel stays stable while the customer drills into one star bucket.
     */
    public PublicProductReviewsResponse getProductReviews(
            String productId, int page, int size, Integer rating, String sort) {
        if (!productRepo.existsById(productId)) {
            throw new NotFoundException("S\u1ea3n ph\u1ea9m kh\u00f4ng t\u1ed3n t\u1ea1i.");
        }

        int normalizedPage = Math.max(DEFAULT_PAGE, page);
        int normalizedSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        PageRequest pageRequest = PageRequest.of(normalizedPage - 1, normalizedSize, resolveSort(sort));
        Page<ReviewEntity> approvedPage = (rating != null && rating >= 1 && rating <= 5)
                ? reviewRepo.findByProductIdAndStatusAndRating(
                        productId, APPROVED_STATUS, (short) rating.intValue(), pageRequest)
                : reviewRepo.findByProductIdAndStatus(productId, APPROVED_STATUS, pageRequest);
        ReviewJpaRepository.ReviewAggregate aggregate =
                reviewRepo.findAggregateByProductIdAndStatus(productId, APPROVED_STATUS);

        double avgRating = roundAverage(aggregate.getAvgRating());
        long totalReviews = aggregate.getTotalReviews() != null ? aggregate.getTotalReviews() : 0L;

        Map<Integer, Long> ratingBreakdown = buildRatingBreakdown(productId);

        List<PublicProductReviewsResponse.ReviewItem> reviews = approvedPage.getContent().stream()
                .map(this::toPublicReviewItem)
                .toList();

        // totalItems/totalPages/hasNext follow the (possibly filtered) list so "load more"
        // pages correctly within a single star bucket; totalReviews stays the global count.
        PaginationMeta pagination = new PaginationMeta(
                normalizedPage,
                normalizedSize,
                approvedPage.getTotalElements(),
                approvedPage.getTotalPages(),
                approvedPage.hasNext(),
                approvedPage.hasPrevious());

        return new PublicProductReviewsResponse(avgRating, totalReviews, ratingBreakdown, reviews, pagination);
    }

    private static Sort resolveSort(String sort) {
        String key = sort != null ? sort.trim().toLowerCase(Locale.ROOT) : "";
        return switch (key) {
            case "highest" -> Sort.by(Sort.Order.desc("rating"), Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            case "lowest" -> Sort.by(Sort.Order.asc("rating"), Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
            default -> Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"));
        };
    }

    @Transactional
    public void submitReview(
            String productId, String authorName, String authorEmail, int rating, String comment,
            List<String> photos) {
        productRepo.findById(productId)
                .orElseThrow(() -> new NotFoundException("S\u1ea3n ph\u1ea9m kh\u00f4ng t\u1ed3n t\u1ea1i."));

        String normalizedName = authorName.trim();
        String normalizedEmail = (authorEmail != null && !authorEmail.isBlank())
                ? authorEmail.trim() : null;
        String normalizedComment = comment != null ? comment.trim() : "";
        List<String> normalizedPhotos = normalizePhotos(photos);
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
        entity.setAuthorEmail(normalizedEmail);
        entity.setRating((short) rating);
        entity.setBody(normalizedComment);
        entity.setPhotos(normalizedPhotos.isEmpty() ? null : normalizedPhotos);
        entity.setStatus("PENDING");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        reviewRepo.save(entity);
    }

    /**
     * Upload one customer review photo to MinIO and return its public URL ({@code /media/reviews/...}).
     * Public path — only checks the product exists; type/size validation lives in the storage service.
     */
    public String uploadReviewPhoto(String productId, MultipartFile file) {
        if (!productRepo.existsById(productId)) {
            throw new NotFoundException("Sản phẩm không tồn tại.");
        }
        return reviewPhotoStorageService.store(file);
    }

    private static List<String> normalizePhotos(List<String> photos) {
        if (photos == null || photos.isEmpty()) {
            return List.of();
        }
        List<String> cleaned = new ArrayList<>(photos.size());
        for (String url : photos) {
            if (url != null && !url.isBlank()) {
                cleaned.add(url.trim());
            }
        }
        return cleaned.size() > MAX_PHOTOS ? cleaned.subList(0, MAX_PHOTOS) : cleaned;
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

    /**
     * Approved-review counts keyed by star value 5→1. Every key is present
     * (zero when no review at that level), so the storefront can render a
     * complete histogram without filling gaps client-side.
     */
    private Map<Integer, Long> buildRatingBreakdown(String productId) {
        Map<Integer, Long> breakdown = new LinkedHashMap<>();
        for (int star = 5; star >= 1; star--) {
            breakdown.put(star, 0L);
        }
        for (Object[] row : reviewRepo.findRatingBreakdownByProductIdAndStatus(productId, APPROVED_STATUS)) {
            if (row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            int star = ((Number) row[0]).intValue();
            if (star >= 1 && star <= 5) {
                breakdown.put(star, ((Number) row[1]).longValue());
            }
        }
        return breakdown;
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
                review.getPhotos() != null ? review.getPhotos() : List.of(),
                review.getCreatedAt() != null ? review.getCreatedAt().toString() : "");
    }
}
