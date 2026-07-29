package com.bigbike.bigbike_backend.service.public_;

import com.bigbike.bigbike_backend.api.common.PaginationMeta;
import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.public_.dto.PublicProductReviewsResponse;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewPhotoUploadJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.customer.CustomerJpaRepository;
import com.bigbike.bigbike_backend.service.review.ReviewRatingLevels;
import com.bigbike.bigbike_backend.service.ws.AdminReviewWsService;
import com.bigbike.bigbike_backend.service.ws.ReviewWsEvent;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
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
    private final ReviewPhotoUploadJpaRepository reviewPhotoUploadRepo;
    private final CustomerJpaRepository customerRepo;
    private final ReviewPhotoStorageService reviewPhotoStorageService;
    private final AdminReviewWsService adminReviewWsService;

    public PublicProductReviewsResponse getProductReviews(String productId, int page, int size) {
        return getProductReviews(productId, page, size, null, null);
    }

    /**
     * @param rating optional star filter, one of the 9 half-star levels 1..5 (REVIEW_RULE_008);
     *               {@code null} returns every approved review.
     * @param sort   ordering key: {@code newest} (default), {@code highest}, {@code lowest}.
     *               The rating filter narrows only the list — avgRating, totalReviews and the
     *               ratingBreakdown histogram always reflect every approved review so the summary
     *               panel stays stable while the customer drills into one star bucket.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PublicProductReviewsResponse getProductReviews(
            String productId, int page, int size, BigDecimal rating, String sort) {
        if (!productRepo.existsById(productId)) {
            throw new NotFoundException("Sản phẩm không tồn tại.");
        }
        if (rating != null && !ReviewRatingLevels.isValid(rating)) {
            throw ValidationException.fromField(
                    "rating",
                    "INVALID",
                    "Đánh giá phải là 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5 hoặc 5 sao.");
        }

        int normalizedPage = Math.max(DEFAULT_PAGE, page);
        int normalizedSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        PageRequest pageRequest = PageRequest.of(normalizedPage - 1, normalizedSize, resolveSort(sort));
        Page<ReviewEntity> approvedPage = rating != null
                ? reviewRepo.findByProductIdAndStatusAndRating(productId, APPROVED_STATUS, rating, pageRequest)
                : reviewRepo.findByProductIdAndStatus(productId, APPROVED_STATUS, pageRequest);
        ReviewJpaRepository.ReviewAggregate aggregate =
                reviewRepo.findAggregateByProductIdAndStatus(productId, APPROVED_STATUS);

        double avgRating = roundAverage(aggregate.getAvgRating());
        long totalReviews = aggregate.getTotalReviews() != null ? aggregate.getTotalReviews() : 0L;

        Map<String, Long> ratingBreakdown = buildRatingBreakdown(productId);

        Map<UUID, String> avatarsByCustomerId = fetchAvatarsByCustomerId(approvedPage.getContent());
        List<PublicProductReviewsResponse.ReviewItem> reviews = approvedPage.getContent().stream()
                .map(r -> toPublicReviewItem(r, avatarsByCustomerId))
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
            String productId, String authorName, String authorEmail, BigDecimal rating, String comment,
            List<String> photos, UUID customerId) {
        // Serialize submissions for one product before the query-then-insert duplicate
        // guard. Without this row lock, two concurrent requests could both observe no
        // duplicate and persist the same normalized author/body pair.
        productRepo.findByIdForUpdate(productId)
                .orElseThrow(() -> new NotFoundException("Sản phẩm không tồn tại."));
        if (!ReviewRatingLevels.isValid(rating)) {
            throw ValidationException.fromField(
                    "rating", "INVALID", "Đánh giá phải là 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5 hoặc 5 sao.");
        }

        ReviewAuthor reviewAuthor = resolveReviewAuthor(customerId, authorName, authorEmail);
        String normalizedName = reviewAuthor.name();
        String normalizedEmail = reviewAuthor.email();
        String normalizedComment = comment != null ? comment.trim() : "";
        List<String> normalizedPhotos = normalizePhotos(photos);
        List<String> photoObjectKeys = validateUniqueReviewPhotoKeys(normalizedPhotos);
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
                    "Bạn đã gửi đánh giá tương tự gần đây. Vui lòng chờ kiểm duyệt hoặc chỉnh sửa nội dung.");
        }

        ReviewEntity entity = new ReviewEntity();
        entity.setProductId(productId);
        entity.setAuthorName(normalizedName);
        entity.setAuthorEmail(normalizedEmail);
        entity.setRating(rating);
        entity.setBody(normalizedComment);
        entity.setPhotos(normalizedPhotos.isEmpty() ? null : normalizedPhotos);
        entity.setStatus("PENDING");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        if (customerId != null) {
            entity.setCustomerId(customerId);
        }

        ReviewEntity saved = reviewRepo.saveAndFlush(entity);
        claimReviewPhotos(productId, saved.getId(), photoObjectKeys, now);
        adminReviewWsService.pushEvent(new ReviewWsEvent(
                "REVIEW_SUBMITTED",
                saved.getId(),
                saved.getProductId(),
                saved.getStatus(),
                Instant.now()));
    }

    /**
     * Upload one customer review photo to MinIO and return its public URL ({@code /media/reviews/...}).
     * Public path — only checks the product exists; type/size validation lives in the storage service.
     */
    public String uploadReviewPhoto(String productId, MultipartFile file) {
        if (!productRepo.existsById(productId)) {
            throw new NotFoundException("Sản phẩm không tồn tại.");
        }
        return reviewPhotoStorageService.store(productId, file);
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

    private ReviewAuthor resolveReviewAuthor(UUID customerId, String authorName, String authorEmail) {
        if (customerId != null) {
            CustomerEntity customer = customerRepo.findById(customerId)
                    .orElseThrow(() -> new NotFoundException("Tài khoản khách hàng không còn tồn tại."));
            String accountEmail = trimToNull(customer.getEmail());
            String accountName = trimToNull(customer.getDisplayName());
            if (accountName == null) {
                accountName = emailLocalPart(accountEmail);
            }
            if (accountName == null) {
                accountName = "Khách hàng";
            }
            return new ReviewAuthor(accountName, accountEmail);
        }

        String guestName = trimToNull(authorName);
        if (guestName == null) {
            throw ValidationException.fromField("authorName", "REQUIRED", "Vui lòng nhập tên.");
        }
        if (guestName.length() > 80) {
            throw ValidationException.fromField(
                    "authorName", "TOO_LONG", "Tên không được vượt quá 80 ký tự.");
        }
        String guestEmail = trimToNull(authorEmail);
        if (guestEmail != null) {
            if (guestEmail.length() > 255) {
                throw ValidationException.fromField(
                        "authorEmail", "TOO_LONG", "Email không được vượt quá 255 ký tự.");
            }
            if (!guestEmail.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
                throw ValidationException.fromField(
                        "authorEmail", "INVALID_EMAIL", "Email không hợp lệ.");
            }
        }
        return new ReviewAuthor(guestName, guestEmail);
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String emailLocalPart(String email) {
        if (email == null) {
            return null;
        }
        int separator = email.indexOf('@');
        String localPart = separator > 0 ? email.substring(0, separator) : email;
        return trimToNull(localPart);
    }

    /**
     * A stored review-photo object may belong to only one review. Comparing canonical
     * object keys also catches legacy absolute URLs that point to the same object as a
     * newer relative URL.
     */
    private List<String> validateUniqueReviewPhotoKeys(List<String> photos) {
        if (photos.isEmpty()) {
            return List.of();
        }

        Set<String> requestedKeys = new LinkedHashSet<>();
        for (String url : photos) {
            String key = ReviewPhotoStorageService.reviewObjectKey(url);
            String canonicalUrl = key != null ? "/media/" + key : null;
            if (key == null || !canonicalUrl.equals(url) || !requestedKeys.add(key)) {
                throw new ConflictException(
                        "Mỗi ảnh chỉ được đính kèm vào một đánh giá và không được lặp lại.");
            }
        }
        return List.copyOf(requestedKeys);
    }

    private void claimReviewPhotos(
            String productId,
            Long reviewId,
            List<String> objectKeys,
            Instant claimedAt
    ) {
        for (String objectKey : objectKeys) {
            int claimed = reviewPhotoUploadRepo.claim(objectKey, productId, reviewId, claimedAt);
            if (claimed != 1) {
                throw new ConflictException(
                        "Ảnh không tồn tại, không thuộc sản phẩm này hoặc đã được dùng cho đánh giá khác.");
            }
        }
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
     * Approved-review counts keyed by star level 5→1, split into the 9 half-star
     * buckets (REVIEW_RULE_008). Every key is present (zero when no review at that
     * level), so the storefront can render a complete histogram without filling gaps
     * client-side.
     */
    private Map<String, Long> buildRatingBreakdown(String productId) {
        Map<String, Long> breakdown = new LinkedHashMap<>();
        for (BigDecimal level : ReviewRatingLevels.DESCENDING) {
            breakdown.put(ReviewRatingLevels.key(level), 0L);
        }
        for (Object[] row : reviewRepo.findRatingBreakdownByProductIdAndStatus(productId, APPROVED_STATUS)) {
            if (row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            BigDecimal star = row[0] instanceof BigDecimal bd ? bd : BigDecimal.valueOf(((Number) row[0]).doubleValue());
            if (ReviewRatingLevels.isValid(star)) {
                breakdown.put(ReviewRatingLevels.key(star), ((Number) row[1]).longValue());
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

    /** Batch-fetches avatar URLs for every distinct linked customerId on the page — avoids an N+1 lookup. */
    private Map<UUID, String> fetchAvatarsByCustomerId(List<ReviewEntity> reviews) {
        List<UUID> customerIds = reviews.stream()
                .map(ReviewEntity::getCustomerId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (customerIds.isEmpty()) {
            return Map.of();
        }
        return customerRepo.findAllById(customerIds).stream()
                .collect(Collectors.toMap(CustomerEntity::getId, c -> c.getAvatarUrl() != null ? c.getAvatarUrl() : ""));
    }

    private PublicProductReviewsResponse.ReviewItem toPublicReviewItem(
            ReviewEntity review, Map<UUID, String> avatarsByCustomerId) {
        String avatarUrl = review.getCustomerId() != null
                ? avatarsByCustomerId.get(review.getCustomerId())
                : null;
        return new PublicProductReviewsResponse.ReviewItem(
                review.getId(),
                review.getAuthorName() != null ? review.getAuthorName() : "Ẩn danh",
                review.getRating(),
                review.getBody() != null ? review.getBody() : "",
                review.getPhotos() != null ? review.getPhotos() : List.of(),
                review.getCreatedAt() != null ? review.getCreatedAt().toString() : "",
                (avatarUrl != null && !avatarUrl.isBlank()) ? avatarUrl : null);
    }

    private record ReviewAuthor(String name, String email) {}
}
