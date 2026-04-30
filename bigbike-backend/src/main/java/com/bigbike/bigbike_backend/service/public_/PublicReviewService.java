package com.bigbike.bigbike_backend.service.public_;

import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PublicReviewService {

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;

    public PublicReviewService(ReviewJpaRepository reviewRepo, ProductJpaRepository productRepo) {
        this.reviewRepo = reviewRepo;
        this.productRepo = productRepo;
    }

    public Map<String, Object> getProductReviews(String productId) {
        List<ReviewEntity> approved = reviewRepo.findByProductIdAndStatusOrderByCreatedAtDesc(productId, "APPROVED");

        double avg = approved.isEmpty() ? 0.0
                : approved.stream().mapToInt(r -> r.getRating()).average().orElse(0.0);
        double avgRounded = Math.round(avg * 10.0) / 10.0;

        List<Map<String, Object>> reviews = approved.stream().map(this::toPublicMap).toList();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("avgRating", avgRounded);
        result.put("totalReviews", approved.size());
        result.put("reviews", reviews);
        return result;
    }

    @Transactional
    public void submitReview(String productId, String authorName, int rating, String comment) {
        productRepo.findById(productId)
                .orElseThrow(() -> new NotFoundException("Sản phẩm không tồn tại."));

        ReviewEntity entity = new ReviewEntity();
        entity.setProductId(productId);
        entity.setAuthorName(authorName.trim());
        entity.setRating((short) rating);
        entity.setBody(comment != null ? comment.trim() : "");
        entity.setStatus("PENDING");
        Instant now = Instant.now();
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);

        reviewRepo.save(entity);
    }

    private Map<String, Object> toPublicMap(ReviewEntity r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("authorName", r.getAuthorName() != null ? r.getAuthorName() : "Ẩn danh");
        m.put("rating", (int) r.getRating());
        m.put("comment", r.getBody() != null ? r.getBody() : "");
        m.put("createdAt", r.getCreatedAt() != null ? r.getCreatedAt().toString() : "");
        return m;
    }
}
