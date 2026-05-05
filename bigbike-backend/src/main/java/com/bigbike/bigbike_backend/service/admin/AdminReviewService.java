package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
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

        List<Map<String, Object>> mapped = dbPage.getContent().stream().map(this::toMap).toList();
        return new PageResult<>(mapped, normalizedPage, normalizedSize,
                dbPage.getTotalElements(), dbPage.getTotalPages());
    }

    public Map<String, Object> getReview(Long id) {
        return toMap(reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found.")));
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
        return Map.of(
                "id", r.getId(),
                "productId", r.getProductId(),
                "authorName", r.getAuthorName() != null ? r.getAuthorName() : "",
                "authorEmail", r.getAuthorEmail() != null ? r.getAuthorEmail() : "",
                "rating", r.getRating(),
                "body", r.getBody() != null ? r.getBody() : "",
                "status", r.getStatus(),
                "createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : "",
                "updatedAt", r.getUpdatedAt() != null ? r.getUpdatedAt().toString() : ""
        );
    }
}
