package com.bigbike.bigbike_backend.service.admin;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.email.EmailDispatchService;
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
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.context.Context;

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
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final WebRevalidationService webRevalidationService;
    private final EmailDispatchService emailDispatchService;
    private final com.bigbike.bigbike_backend.service.public_.ReviewPhotoStorageService reviewPhotoStorageService;
    private final String siteBaseUrl;

    public AdminReviewService(
            ReviewJpaRepository reviewRepo,
            ProductJpaRepository productRepo,
            AuditLogWriter auditLogWriter,
            AuditLogFactory auditLogFactory,
            WebRevalidationService webRevalidationService,
            EmailDispatchService emailDispatchService,
            com.bigbike.bigbike_backend.service.public_.ReviewPhotoStorageService reviewPhotoStorageService,
            @Value("${bigbike.site.base-url:https://bigbike.vn}") String siteBaseUrl
    ) {
        this.reviewRepo = reviewRepo;
        this.productRepo = productRepo;
        this.auditLogWriter = auditLogWriter;
        this.auditLogFactory = auditLogFactory;
        this.webRevalidationService = webRevalidationService;
        this.emailDispatchService = emailDispatchService;
        this.reviewPhotoStorageService = reviewPhotoStorageService;
        this.siteBaseUrl = siteBaseUrl;
    }

    // AUD-073: the review list intentionally returns ALL reviews with both product
    // names (productName + productNameEn); the admin UI picks the right name by its
    // content-language toggle and falls back to VI when EN is missing (PRODUCT_RULE_004
    // — never hide untranslated records). Reviews are single-language user content, so
    // there is no server-side language filtering; the `lang` request param is accepted
    // for API compatibility but does not change the result set.
    public PageResult<Map<String, Object>> listReviews(int page, int size, String q, String status, String lang) {
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
        // strictEnglish=false → show all reviews regardless of product translation state.
        Page<ReviewEntity> dbPage = reviewRepo.findByFilters(statusFilter, qFilter, false, pageRequest);

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
            throw ValidationException.fromField("status", "REQUIRED", "Trạng thái không được để trống.");
        }

        String normalized = status.toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw ValidationException.fromField(
                    "status",
                    "INVALID",
                    "Trạng thái không hợp lệ. Chỉ chấp nhận: APPROVED, PENDING, SPAM, TRASH."
            );
        }

        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        ProductReviewMetadata productMetadata = loadProductMetadata(List.of(entity)).get(entity.getProductId());
        Instant now = Instant.now();
        String before = snapshot(entity, productMetadata);
        String previousStatus = entity.getStatus();

        entity.setStatus(normalized);
        entity.setUpdatedAt(now);

        ReviewEntity saved = reviewRepo.save(entity);
        reviewRepo.flush();
        recomputeProductReviewAggregate(entity.getProductId());
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN",
                adminId,
                REVIEW_STATUS_CHANGED_ACTION,
                REVIEW_RESOURCE_TYPE,
                null,
                before,
                snapshot(saved, productMetadata),
                ipAddress,
                userAgent
        ));

        Map<String, Object> result = toMap(saved, productMetadata);
        revalidateProduct(entity.getProductId());

        if (APPROVED_STATUS.equals(normalized) && !APPROVED_STATUS.equals(previousStatus)
                && entity.getAuthorEmail() != null && !entity.getAuthorEmail().isBlank()) {
            sendReviewApprovedEmail(entity, productMetadata);
        }

        return result;
    }

    /**
     * Bulk moderation — same per-item logic as {@link #updateStatus} but looped server-side
     * in one request/transaction instead of the admin browser firing N sequential HTTP
     * requests (see ReviewListScreen.jsx runBulk). Best-effort: a missing/invalid id is
     * skipped rather than aborting the whole batch, mirroring AdminMediaService.bulkSoftDelete.
     */
    @Transactional
    public int bulkUpdateStatus(UUID adminId, List<Long> ids, String status, String ipAddress, String userAgent) {
        if (ids == null || ids.isEmpty()) return 0;
        int count = 0;
        for (Long id : ids) {
            try {
                updateStatus(adminId, id, status, ipAddress, userAgent);
                count++;
            } catch (NotFoundException ignored) {
                // skip missing ones — caller asked for best-effort
            }
        }
        return count;
    }

    /** Bulk counterpart of {@link #deleteReview}. See {@link #bulkUpdateStatus} for the pattern. */
    @Transactional
    public int bulkDelete(UUID adminId, List<Long> ids, String ipAddress, String userAgent) {
        if (ids == null || ids.isEmpty()) return 0;
        int count = 0;
        for (Long id : ids) {
            try {
                deleteReview(adminId, id, ipAddress, userAgent);
                count++;
            } catch (NotFoundException ignored) {
                // skip missing ones — caller asked for best-effort
            }
        }
        return count;
    }

    private void sendReviewApprovedEmail(ReviewEntity review, ProductReviewMetadata productMetadata) {
        Context ctx = new Context();
        ctx.setVariable("authorName", review.getAuthorName() != null ? review.getAuthorName() : "Khách hàng");
        ctx.setVariable("productName", productMetadata != null ? productMetadata.name() : "sản phẩm");
        String productUrl = (productMetadata != null && productMetadata.slug() != null)
                ? siteBaseUrl + "/san-pham/" + productMetadata.slug()
                : siteBaseUrl;
        ctx.setVariable("productUrl", productUrl);
        emailDispatchService.send(
                review.getAuthorEmail(),
                "Đánh giá của bạn đã được đăng — BigBike",
                "review-approved",
                ctx
        );
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
        List<String> photos = entity.getPhotos();
        Instant now = Instant.now();
        String before = snapshot(entity, productMetadata);

        reviewRepo.delete(entity);
        reviewRepo.flush();
        // Remove the review's MinIO photos so they don't linger as orphans (AUD-037).
        reviewPhotoStorageService.deletePhotos(photos);
        recomputeProductReviewAggregate(productId);
        auditLogWriter.save(auditLogFactory.build(
                "ADMIN",
                adminId,
                REVIEW_DELETED_ACTION,
                REVIEW_RESOURCE_TYPE,
                null,
                before,
                deletedSnapshot(entity, productMetadata),
                ipAddress,
                userAgent
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
            result.put(product.getId(), new ProductReviewMetadata(product.getName(), product.getNameEn(), product.getSlug()));
        }
        return result;
    }

    private Map<String, Object> toMap(ReviewEntity review, ProductReviewMetadata productMetadata) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", review.getId());
        payload.put("productId", review.getProductId());
        payload.put("productName", productMetadata != null ? productMetadata.name() : null);
        payload.put("productNameEn", productMetadata != null ? productMetadata.nameEn() : null);
        payload.put("productSlug", productMetadata != null ? productMetadata.slug() : null);
        payload.put("authorName", review.getAuthorName() != null ? review.getAuthorName() : "");
        payload.put("authorEmail", review.getAuthorEmail() != null ? review.getAuthorEmail() : "");
        payload.put("rating", review.getRating());
        payload.put("body", review.getBody() != null ? review.getBody() : "");
        payload.put("photos", review.getPhotos() != null ? review.getPhotos() : List.of());
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

    private record ProductReviewMetadata(String name, String nameEn, String slug) {}
}
