package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.audit.AuditLogEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.persistence.repository.audit.AuditLogJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
    private static final String APPROVED_STATUS = "APPROVED";
    private static final Set<String> ALLOWED_STATUSES = Set.of("APPROVED", "PENDING", "SPAM", "TRASH");
    private static final String REVIEW_RESOURCE_TYPE = "REVIEW";
    private static final String REVIEW_STATUS_CHANGED_ACTION = "REVIEW_STATUS_CHANGED";
    private static final String REVIEW_DELETED_ACTION = "REVIEW_DELETED";
    private static final ObjectMapper OBJECT_MAPPER = JsonMapper.builder().findAndAddModules().build();

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;
    private final AuditLogJpaRepository auditLogRepo;
    private final WebRevalidationService webRevalidationService;

    public AdminReviewService(
            ReviewJpaRepository reviewRepo,
            ProductJpaRepository productRepo,
            AuditLogJpaRepository auditLogRepo,
            WebRevalidationService webRevalidationService
    ) {
        this.reviewRepo = reviewRepo;
        this.productRepo = productRepo;
        this.auditLogRepo = auditLogRepo;
        this.webRevalidationService = webRevalidationService;
    }

    public PageResult<Map<String, Object>> listReviews(int page, int size, String q, String status) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        // Empty string (not null) keeps repository filter logic predictable for blank status values.
        String statusFilter = (status != null && !status.isBlank()) ? status.toUpperCase(Locale.ROOT) : "";
        String qFilter = (q != null && !q.isBlank()) ? q : "";

        PageRequest pageRequest = PageRequest.of(
                normalizedPage - 1,
                normalizedSize,
                Sort.by(Sort.Direction.DESC, "createdAt")
        );
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
    public Map<String, Object> updateStatus(
            UUID adminId,
            Long id,
            String status,
            String ipAddress,
            String userAgent
    ) {
        if (status == null || status.isBlank()) {
            throw ValidationException.fromField("status", "REQUIRED", "Tráº¡ng thĂ¡i khĂ´ng Ä‘Æ°á»£c Ä‘á»ƒ trá»‘ng.");
        }

        String normalized = status.toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw ValidationException.fromField(
                    "status",
                    "INVALID",
                    "Tráº¡ng thĂ¡i khĂ´ng há»£p lá»‡. Chá»‰ cháº¥p nháº­n: APPROVED, PENDING, SPAM, TRASH."
            );
        }

        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        ProductReviewMetadata productMetadata = loadProductMetadata(List.of(entity)).get(entity.getProductId());
        Instant now = Instant.now();
        String before = snapshot(entity, productMetadata);

        entity.setStatus(normalized);
        entity.setUpdatedAt(now);

        ReviewEntity saved = reviewRepo.save(entity);
        reviewRepo.flush();
        recomputeProductReviewAggregate(entity.getProductId());
        auditLogRepo.save(buildAudit(
                adminId,
                REVIEW_STATUS_CHANGED_ACTION,
                before,
                snapshot(saved, productMetadata),
                ipAddress,
                userAgent,
                now
        ));

        Map<String, Object> result = toMap(saved, productMetadata);
        revalidateProduct(entity.getProductId());
        return result;
    }

    @Transactional
    public void deleteReview(
            UUID adminId,
            Long id,
            String ipAddress,
            String userAgent
    ) {
        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        ProductReviewMetadata productMetadata = loadProductMetadata(List.of(entity)).get(entity.getProductId());
        String productId = entity.getProductId();
        Instant now = Instant.now();
        String before = snapshot(entity, productMetadata);

        reviewRepo.delete(entity);
        reviewRepo.flush();
        recomputeProductReviewAggregate(productId);
        auditLogRepo.save(buildAudit(
                adminId,
                REVIEW_DELETED_ACTION,
                before,
                deletedSnapshot(entity, productMetadata),
                ipAddress,
                userAgent,
                now
        ));

        revalidateProduct(productId);
    }

    private void recomputeProductReviewAggregate(String productId) {
        if (productId == null || productId.isBlank()) {
            return;
        }

        productRepo.findByIdForUpdate(productId).ifPresent(product -> {
            ReviewJpaRepository.ReviewAggregate aggregate =
                    reviewRepo.findAggregateByProductIdAndStatus(productId, APPROVED_STATUS);
            int totalReviews = aggregate.getTotalReviews() != null
                    ? Math.toIntExact(aggregate.getTotalReviews())
                    : 0;
            product.setRating(totalReviews > 0 ? toCachedRating(aggregate.getAvgRating()) : null);
            product.setRatingCount(totalReviews);
        });
    }

    private void revalidateProduct(String productId) {
        if (productId == null) {
            return;
        }
        productRepo.findById(productId).ifPresent(product -> {
            String slug = product.getSlug();
            if (slug != null && !slug.isBlank()) {
                webRevalidationService.revalidate("product:" + slug, "products");
            }
        });
    }

    private Map<String, Object> toMap(ReviewEntity review) {
        return toMap(review, loadProductMetadata(List.of(review)).get(review.getProductId()));
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

    private String snapshot(ReviewEntity review, ProductReviewMetadata productMetadata) {
        return writeJson(toMap(review, productMetadata));
    }

    private String deletedSnapshot(ReviewEntity review, ProductReviewMetadata productMetadata) {
        Map<String, Object> payload = new LinkedHashMap<>(toMap(review, productMetadata));
        payload.put("deleted", true);
        return writeJson(payload);
    }

    private AuditLogEntity buildAudit(
            UUID adminId,
            String action,
            String before,
            String after,
            String ipAddress,
            String userAgent,
            Instant now
    ) {
        AuditLogEntity log = new AuditLogEntity();
        log.setActorType("ADMIN");
        log.setActorId(adminId);
        log.setAction(action);
        log.setResourceType(REVIEW_RESOURCE_TYPE);
        log.setBeforeData(before);
        log.setAfterData(after);
        log.setIpAddress(blankToNull(ipAddress));
        log.setUserAgent(blankToNull(userAgent));
        log.setCreatedAt(now);
        return log;
    }

    private String writeJson(Map<String, Object> payload) {
        try {
            return OBJECT_MAPPER.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize review audit payload.", exception);
        }
    }

    private BigDecimal toCachedRating(Double avgRating) {
        if (avgRating == null) {
            return null;
        }
        return BigDecimal.valueOf(avgRating).setScale(1, RoundingMode.HALF_UP);
    }

    private String blankToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value;
    }

    private record ProductReviewMetadata(String name, String slug) {}
}
