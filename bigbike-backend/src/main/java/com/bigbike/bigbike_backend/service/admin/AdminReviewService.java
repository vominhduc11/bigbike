package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminReviewService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_STATUSES = Set.of("APPROVED", "PENDING", "SPAM", "TRASH");

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;
    private final WebRevalidationService webRevalidationService;

    public AdminReviewService(
            ReviewJpaRepository reviewRepo,
            ProductJpaRepository productRepo,
            WebRevalidationService webRevalidationService) {
        this.reviewRepo = reviewRepo;
        this.productRepo = productRepo;
        this.webRevalidationService = webRevalidationService;
    }

    public PageResult<Map<String, Object>> listReviews(int page, int size, String q, String status) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        // Empty string (not null) — see ReviewJpaRepository.findByFilters comment for why.
        String statusFilter = (status != null && !status.isBlank()) ? status.toUpperCase(Locale.ROOT) : "";
        String qFilter = (q != null && !q.isBlank()) ? q : "";

        PageRequest pageRequest = PageRequest.of(
                normalizedPage - 1, normalizedSize, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<ReviewEntity> dbPage = reviewRepo.findByFilters(statusFilter, qFilter, pageRequest);

        Map<String, ProductReviewMetadata> productMetadata = loadProductMetadata(dbPage.getContent());
        List<Map<String, Object>> mapped = dbPage.getContent().stream()
                .map(review -> toMap(review, productMetadata.get(review.getProductId())))
                .toList();
        return new PageResult<>(mapped, normalizedPage, normalizedSize,
                dbPage.getTotalElements(), dbPage.getTotalPages());
    }

    public Map<String, Object> getReview(Long id) {
        ReviewEntity review = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        return toMap(review);
    }

    @Transactional
    public Map<String, Object> updateStatus(Long id, String status) {
        if (status == null || status.isBlank()) {
            throw ValidationException.fromField("status", "REQUIRED", "Trạng thái không được để trống.");
        }
        String normalized = status.toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw ValidationException.fromField("status", "INVALID",
                    "Trạng thái không hợp lệ. Chỉ chấp nhận: APPROVED, PENDING, SPAM, TRASH.");
        }
        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        entity.setStatus(normalized);
        entity.setUpdatedAt(Instant.now());
        Map<String, Object> result = toMap(reviewRepo.save(entity));
        revalidateProduct(entity.getProductId());
        return result;
    }

    @Transactional
    public void deleteReview(Long id) {
        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        String productId = entity.getProductId();
        reviewRepo.delete(entity);
        revalidateProduct(productId);
    }

    private void revalidateProduct(String productId) {
        if (productId == null) return;
        productRepo.findById(productId).ifPresent(p -> {
            String slug = p.getSlug();
            if (slug != null && !slug.isBlank()) {
                webRevalidationService.revalidate("product:" + slug, "products");
            }
        });
    }

    private Map<String, Object> toMap(ReviewEntity r) {
        return toMap(r, loadProductMetadata(List.of(r)).get(r.getProductId()));
    }

    private Map<String, ProductReviewMetadata> loadProductMetadata(List<ReviewEntity> reviews) {
        Set<String> productIds = reviews.stream()
                .map(ReviewEntity::getProductId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toSet());
        if (productIds.isEmpty()) {
            return Map.of();
        }

        Map<String, ProductReviewMetadata> result = new HashMap<>();
        for (ProductEntity product : productRepo.findAllById(productIds)) {
            result.put(product.getId(), new ProductReviewMetadata(product.getName(), product.getSlug()));
        }
        return result;
    }

    private Map<String, Object> toMap(ReviewEntity review, ProductReviewMetadata productMetadata) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", review.getId());
        payload.put("productId", review.getProductId());
        payload.put("productName", productMetadata != null ? productMetadata.name() : null);
        payload.put("productSlug", productMetadata != null ? productMetadata.slug() : null);
        payload.put("authorName", review.getAuthorName() != null ? review.getAuthorName() : "");
        payload.put("authorEmail", review.getAuthorEmail() != null ? review.getAuthorEmail() : "");
        payload.put("rating", review.getRating());
        payload.put("body", review.getBody() != null ? review.getBody() : "");
        payload.put("status", review.getStatus());
        payload.put("createdAt", review.getCreatedAt() != null ? review.getCreatedAt().toString() : "");
        payload.put("updatedAt", review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
        return payload;
    }

    private record ProductReviewMetadata(String name, String slug) {}
}
