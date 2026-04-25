package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminReviewService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final Set<String> ALLOWED_STATUSES = Set.of("APPROVED", "PENDING", "SPAM", "TRASH");

    private final ReviewJpaRepository reviewRepo;
    private final PaginationService paginationService;

    public AdminReviewService(ReviewJpaRepository reviewRepo, PaginationService paginationService) {
        this.reviewRepo = reviewRepo;
        this.paginationService = paginationService;
    }

    public PageResult<Map<String, Object>> listReviews(int page, int size, String q, String status) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        List<ReviewEntity> all = reviewRepo.findAll();
        if (q != null && !q.isBlank()) {
            String qLower = q.toLowerCase(Locale.ROOT);
            all = all.stream()
                    .filter(r -> matches(r.getAuthorName(), qLower) || matches(r.getBody(), qLower))
                    .toList();
        }
        if (status != null && !status.isBlank()) {
            all = all.stream().filter(r -> status.equalsIgnoreCase(r.getStatus())).toList();
        }
        List<Map<String, Object>> mapped = all.stream().map(this::toMap).toList();
        return paginationService.paginate(mapped, normalizedPage, normalizedSize);
    }

    public Map<String, Object> getReview(Long id) {
        return toMap(reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found.")));
    }

    @Transactional
    public Map<String, Object> updateStatus(Long id, String status) {
        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        entity.setStatus(status.toUpperCase(Locale.ROOT));
        entity.setUpdatedAt(Instant.now());
        return toMap(reviewRepo.save(entity));
    }

    @Transactional
    public void deleteReview(Long id) {
        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        reviewRepo.delete(entity);
    }

    private boolean matches(String field, String q) {
        return field != null && field.toLowerCase(Locale.ROOT).contains(q);
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
