package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewSummaryResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.bigbike.bigbike_backend.api.error.ConflictException;
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
import com.bigbike.bigbike_backend.service.public_.ReviewPhotoStorageService;
import com.bigbike.bigbike_backend.service.review.ReviewModerationOutcome;
import com.bigbike.bigbike_backend.service.review.ReviewRatingLevels;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import com.bigbike.bigbike_backend.service.ws.AdminReviewWsService;
import com.bigbike.bigbike_backend.service.ws.ReviewWsEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.thymeleaf.context.Context;

@Service
@Slf4j
public class AdminReviewService {

    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;
    private static final String APPROVED_STATUS = "APPROVED";
    private static final Set<String> ALLOWED_STATUSES = Set.of("APPROVED", "PENDING", "SPAM", "TRASH");
    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
            "PENDING", Set.of("APPROVED", "SPAM", "TRASH"),
            "APPROVED", Set.of("PENDING"),
            "SPAM", Set.of("PENDING"),
            "TRASH", Set.of("PENDING"));
    private static final String REVIEW_RESOURCE_TYPE = "REVIEW";
    private static final String REVIEW_STATUS_CHANGED_ACTION = "REVIEW_STATUS_CHANGED";
    private static final String REVIEW_DELETED_ACTION = "REVIEW_DELETED";
    /** Distinct from the human action so audit can tell a machine block from a moderator's. */
    private static final String REVIEW_AUTO_MODERATED_ACTION = "REVIEW_AUTO_MODERATED";
    private static final String SYSTEM_ACTOR_TYPE = "SYSTEM";
    private static final int MODERATION_REASON_MAX_LENGTH = 500;
    private static final ObjectMapper OBJECT_MAPPER = JsonMapper.builder().findAndAddModules().build();

    private final ReviewJpaRepository reviewRepo;
    private final ProductJpaRepository productRepo;
    private final AuditLogWriter auditLogWriter;
    private final AuditLogFactory auditLogFactory;
    private final WebRevalidationService webRevalidationService;
    private final EmailDispatchService emailDispatchService;
    private final ReviewPhotoStorageService reviewPhotoStorageService;
    private final AdminReviewWsService adminReviewWsService;
    private final TransactionTemplate requiresNewTransaction;
    private final String siteBaseUrl;

    public AdminReviewService(
            ReviewJpaRepository reviewRepo,
            ProductJpaRepository productRepo,
            AuditLogWriter auditLogWriter,
            AuditLogFactory auditLogFactory,
            WebRevalidationService webRevalidationService,
            EmailDispatchService emailDispatchService,
            ReviewPhotoStorageService reviewPhotoStorageService,
            AdminReviewWsService adminReviewWsService,
            PlatformTransactionManager transactionManager,
            @Value("${bigbike.site.base-url:https://bigbike.vn}") String siteBaseUrl
    ) {
        this.reviewRepo = reviewRepo;
        this.productRepo = productRepo;
        this.auditLogWriter = auditLogWriter;
        this.auditLogFactory = auditLogFactory;
        this.webRevalidationService = webRevalidationService;
        this.emailDispatchService = emailDispatchService;
        this.reviewPhotoStorageService = reviewPhotoStorageService;
        this.adminReviewWsService = adminReviewWsService;
        this.requiresNewTransaction = new TransactionTemplate(transactionManager);
        this.requiresNewTransaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.siteBaseUrl = siteBaseUrl;
    }

    // AUD-073: the review list intentionally returns ALL reviews with both product
    // names (productName + productNameEn); the admin UI picks the right name by its
    // content-language toggle and falls back to VI when EN is missing (PRODUCT_RULE_004
    // — never hide untranslated records). Reviews are single-language user content, so
    // there is no server-side language filtering; the `lang` request param is accepted
    // for API compatibility but does not change the result set.
    public PageResult<Map<String, Object>> listReviews(int page, int size, String q, String status, BigDecimal rating, String lang) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = (size <= 0) ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);

        // Empty string (not null) keeps repository filter logic predictable for blank status values.
        String statusFilter = (status != null && !status.isBlank()) ? status.toUpperCase(Locale.ROOT) : "";
        if (!statusFilter.isEmpty() && !ALLOWED_STATUSES.contains(statusFilter)) {
            throw ValidationException.fromField(
                    "status",
                    "INVALID",
                    "Trạng thái lọc không hợp lệ. Chỉ chấp nhận: APPROVED, PENDING, SPAM, TRASH.");
        }
        String qFilter = (q != null && !q.isBlank()) ? escapeLikePattern(q.trim()) : "";
        if (rating != null && !ReviewRatingLevels.isValid(rating)) {
            throw ValidationException.fromField(
                    "rating",
                    "INVALID",
                    "Mức sao phải là 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5 hoặc 5.");
        }
        BigDecimal ratingFilter = rating != null ? rating : BigDecimal.ZERO;

        PageRequest pageRequest = PageRequest.of(
                normalizedPage - 1,
                normalizedSize,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))
        );
        // strictEnglish=false → show all reviews regardless of product translation state.
        Page<ReviewEntity> dbPage = reviewRepo.findByFilters(statusFilter, qFilter, ratingFilter, false, pageRequest);

        Map<String, ProductReviewMetadata> productMetadata = loadProductMetadata(dbPage.getContent());
        List<Map<String, Object>> mapped = dbPage.getContent().stream()
                .map(review -> toMap(review, productMetadata.get(review.getProductId()), false))
                .toList();
        return new PageResult<>(mapped, normalizedPage, normalizedSize,
                dbPage.getTotalElements(), dbPage.getTotalPages());
    }

    /**
     * Global moderation KPIs. This deliberately does not use the paginated list,
     * because the admin list may be filtered or show only one page.
     */
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public AdminReviewSummaryResponse getSummary() {
        ReviewJpaRepository.ReviewAggregate approved =
                reviewRepo.findGlobalAggregateByStatus(APPROVED_STATUS);
        BigDecimal average = approved.getAvgRating() == null
                ? BigDecimal.ZERO.setScale(1)
                : BigDecimal.valueOf(approved.getAvgRating()).setScale(1, RoundingMode.HALF_UP);

        Map<String, Long> breakdown = new LinkedHashMap<>();
        Map<BigDecimal, Long> grouped = reviewRepo.findGlobalRatingBreakdownByStatus(APPROVED_STATUS).stream()
                .collect(Collectors.toMap(
                        row -> row[0] instanceof BigDecimal bd ? bd : BigDecimal.valueOf(((Number) row[0]).doubleValue()),
                        row -> ((Number) row[1]).longValue()
                ));
        for (BigDecimal level : ReviewRatingLevels.DESCENDING) {
            long count = grouped.entrySet().stream()
                    .filter(e -> e.getKey().compareTo(level) == 0)
                    .mapToLong(Map.Entry::getValue)
                    .sum();
            breakdown.put(ReviewRatingLevels.key(level), count);
        }

        return new AdminReviewSummaryResponse(
                new AdminReviewSummaryResponse.ApprovedSummary(
                        average,
                        approved.getTotalReviews() == null ? 0L : approved.getTotalReviews(),
                        breakdown
                ),
                new AdminReviewSummaryResponse.PendingSummary(
                        reviewRepo.countByStatus("PENDING"),
                        reviewRepo.countByStatusAndRating("PENDING", new BigDecimal("1.0"))
                )
        );
    }

    public Map<String, Object> getReview(Long id) {
        ReviewEntity review = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        return toDetailMap(review);
    }

    @Transactional
    public Map<String, Object> updateStatus(
            UUID adminId,
            Long id,
            String status,
            Long expectedVersion,
            String ipAddress,
            String userAgent
    ) {
        return updateStatusOutcome(
                adminId, id, status, expectedVersion, ipAddress, userAgent).payload();
    }

    private StatusUpdateOutcome updateStatusOutcome(
            UUID adminId,
            Long id,
            String status,
            Long expectedVersion,
            String ipAddress,
            String userAgent
    ) {
        String normalized = validateStatus(status);
        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        requireExpectedVersion(entity, expectedVersion);
        ProductReviewMetadata productMetadata =
                loadProductMetadata(List.of(entity)).get(entity.getProductId());
        String previousStatus = entity.getStatus();

        if (normalized.equals(previousStatus)) {
            return new StatusUpdateOutcome(toMap(entity, productMetadata, false), false);
        }
        if (!ALLOWED_TRANSITIONS.getOrDefault(previousStatus, Set.of()).contains(normalized)) {
            throw new ConflictException(
                    "Không thể chuyển đánh giá từ " + previousStatus + " sang " + normalized + ".");
        }

        Instant now = Instant.now();
        String before = snapshot(entity, productMetadata);
        boolean firstApproval = APPROVED_STATUS.equals(normalized)
                && entity.getFirstApprovedAt() == null;
        entity.setStatus(normalized);
        entity.setUpdatedAt(now);
        if (firstApproval) {
            entity.setFirstApprovedAt(now);
        }

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
        revalidateProduct(entity.getProductId());

        if (firstApproval && entity.getAuthorEmail() != null
                && !entity.getAuthorEmail().isBlank()) {
            sendReviewApprovedEmailAfterCommit(entity, productMetadata);
        }
        return new StatusUpdateOutcome(toMap(saved, productMetadata, false), true);
    }

    /**
     * Persists what the automatic moderator concluded and, when it found a blocking
     * violation, performs the `PENDING → SPAM|TRASH` transition on its behalf
     * (REVIEW_RULE_012).
     *
     * <p>Three guarantees this method is responsible for:
     * <ul>
     *   <li><b>Never publishes.</b> Only the two blocking statuses are reachable here; there
     *       is no branch that can set {@code APPROVED}, so no approval email can fire.</li>
     *   <li><b>Never overrides a human.</b> The transition happens only while the row is
     *       still {@code PENDING}. If a moderator got there first, the verdict is recorded
     *       as an annotation and the status is left exactly as the human left it.</li>
     *   <li><b>Annotates either way.</b> Even a skipped or clean run writes the annotation
     *       columns, so the admin screen can distinguish "checked, nothing found" from
     *       "never checked".</li>
     * </ul>
     */
    @Transactional
    public void applyAutoModeration(Long reviewId, ReviewModerationOutcome outcome) {
        if (reviewId == null || outcome == null) {
            return;
        }
        ReviewEntity entity = reviewRepo.findById(reviewId).orElse(null);
        if (entity == null) {
            // Deleted between submit and moderation — nothing left to annotate.
            return;
        }

        String targetStatus = outcome.resolvedTargetStatus().orElse(null);
        boolean transitions = targetStatus != null && "PENDING".equals(entity.getStatus());
        ProductReviewMetadata productMetadata =
                loadProductMetadata(List.of(entity)).get(entity.getProductId());
        String before = transitions ? snapshot(entity, productMetadata) : null;

        Instant now = Instant.now();
        List<String> categoryNames = outcome.categoryNames();
        entity.setModerationSource(outcome.source());
        entity.setModerationVerdict(outcome.verdict());
        entity.setModerationCategories(categoryNames.isEmpty() ? null : categoryNames);
        entity.setModerationReason(truncateReason(outcome.reason()));
        entity.setModerationCheckedAt(now);
        if (transitions) {
            entity.setStatus(targetStatus);
            entity.setUpdatedAt(now);
        }

        ReviewEntity saved = reviewRepo.save(entity);
        reviewRepo.flush();

        if (transitions) {
            recomputeProductReviewAggregate(saved.getProductId());
            auditLogWriter.save(auditLogFactory.build(
                    SYSTEM_ACTOR_TYPE,
                    null,
                    REVIEW_AUTO_MODERATED_ACTION,
                    REVIEW_RESOURCE_TYPE,
                    null,
                    before,
                    autoModerationSnapshot(saved, productMetadata, outcome),
                    null,
                    null
            ));
            revalidateProduct(saved.getProductId());
        }

        // Always notify: the annotation alone changes the row's version, so an open
        // moderation screen must refetch to avoid a surprise 409 on its next action.
        adminReviewWsService.pushEvent(new ReviewWsEvent(
                "REVIEW_AUTO_MODERATED",
                saved.getId(),
                saved.getProductId(),
                saved.getStatus(),
                Instant.now()));
    }

    private static String truncateReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return null;
        }
        String trimmed = reason.trim();
        return trimmed.length() > MODERATION_REASON_MAX_LENGTH
                ? trimmed.substring(0, MODERATION_REASON_MAX_LENGTH)
                : trimmed;
    }

    public BulkReviewResult bulkUpdateStatus(
            UUID adminId,
            List<VersionedReviewId> items,
            String status,
            String ipAddress,
            String userAgent
    ) {
        validateStatus(status);
        if (items == null || items.isEmpty()) {
            return new BulkReviewResult(0, List.of());
        }

        int affected = 0;
        Set<Long> seen = new LinkedHashSet<>();
        List<BulkReviewSkipped> skipped = new java.util.ArrayList<>();
        for (VersionedReviewId item : items) {
            if (!seen.add(item.id())) {
                skipped.add(new BulkReviewSkipped(item.id(), "DUPLICATE_ID"));
                continue;
            }
            try {
                StatusUpdateOutcome outcome = requiresNewTransaction.execute(transactionStatus ->
                        updateStatusOutcome(
                                adminId,
                                item.id(),
                                status,
                                item.expectedVersion(),
                                ipAddress,
                                userAgent));
                if (outcome != null && outcome.changed()) {
                    affected++;
                } else {
                    skipped.add(new BulkReviewSkipped(item.id(), "NO_CHANGE"));
                }
            } catch (NotFoundException exception) {
                skipped.add(new BulkReviewSkipped(item.id(), "NOT_FOUND"));
            } catch (ObjectOptimisticLockingFailureException exception) {
                skipped.add(new BulkReviewSkipped(item.id(), "VERSION_CONFLICT"));
            } catch (ConflictException exception) {
                skipped.add(new BulkReviewSkipped(item.id(), "INVALID_TRANSITION"));
            }
        }
        return new BulkReviewResult(affected, List.copyOf(skipped));
    }

    public BulkReviewResult bulkDelete(
            UUID adminId,
            List<VersionedReviewId> items,
            String ipAddress,
            String userAgent
    ) {
        if (items == null || items.isEmpty()) {
            return new BulkReviewResult(0, List.of());
        }

        int affected = 0;
        Set<Long> seen = new LinkedHashSet<>();
        List<BulkReviewSkipped> skipped = new java.util.ArrayList<>();
        List<String> deletedPhotoCandidates = new java.util.ArrayList<>();
        for (VersionedReviewId item : items) {
            if (!seen.add(item.id())) {
                skipped.add(new BulkReviewSkipped(item.id(), "DUPLICATE_ID"));
                continue;
            }
            try {
                List<String> itemPhotos = requiresNewTransaction.execute(transactionStatus ->
                        deleteReviewInternal(
                                adminId,
                                item.id(),
                                item.expectedVersion(),
                                ipAddress,
                                userAgent));
                if (itemPhotos != null) {
                    deletedPhotoCandidates.addAll(itemPhotos);
                }
                affected++;
            } catch (NotFoundException exception) {
                skipped.add(new BulkReviewSkipped(item.id(), "NOT_FOUND"));
            } catch (ObjectOptimisticLockingFailureException exception) {
                skipped.add(new BulkReviewSkipped(item.id(), "VERSION_CONFLICT"));
            } catch (ConflictException exception) {
                skipped.add(new BulkReviewSkipped(item.id(), "NOT_IN_TRASH"));
            }
        }
        if (!deletedPhotoCandidates.isEmpty()) {
            deleteUnreferencedReviewPhotos(deletedPhotoCandidates);
        }
        return new BulkReviewResult(affected, List.copyOf(skipped));
    }

    private void sendReviewApprovedEmail(ReviewEntity review, ProductReviewMetadata productMetadata) {
        Context ctx = new Context();
        ctx.setVariable("authorName", review.getAuthorName() != null ? review.getAuthorName() : "Khách hàng");
        ctx.setVariable("productName", productMetadata != null ? productMetadata.name() : "sản phẩm");
        String productUrl = productMetadata != null
                ? buildProductUrl(siteBaseUrl, productMetadata.slug())
                : normalizeSiteBaseUrl(siteBaseUrl);
        ctx.setVariable("productUrl", productUrl);
        emailDispatchService.send(
                review.getAuthorEmail(),
                "Đánh giá của bạn đã được đăng — BigBike",
                "review-approved",
                ctx
        );
    }

    private void sendReviewApprovedEmailAfterCommit(
            ReviewEntity review,
            ProductReviewMetadata productMetadata
    ) {
        Runnable send = () -> sendReviewApprovedEmail(review, productMetadata);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
            return;
        }
        send.run();
    }

    @Transactional
    public void deleteReview(
            UUID adminId,
            Long id,
            Long expectedVersion,
            String ipAddress,
            String userAgent
    ) {
        List<String> photos =
                deleteReviewInternal(adminId, id, expectedVersion, ipAddress, userAgent);
        scheduleReferenceSafePhotoCleanup(photos);
    }

    private List<String> deleteReviewInternal(
            UUID adminId,
            Long id,
            Long expectedVersion,
            String ipAddress,
            String userAgent
    ) {
        ReviewEntity entity = reviewRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("Review not found."));
        requireExpectedVersion(entity, expectedVersion);
        if (!"TRASH".equals(entity.getStatus())) {
            throw new ConflictException(
                    "Chỉ đánh giá trong Thùng rác mới được xóa vĩnh viễn.");
        }
        ProductReviewMetadata productMetadata = loadProductMetadata(List.of(entity)).get(entity.getProductId());
        String productId = entity.getProductId();
        List<String> photos = entity.getPhotos();
        String before = snapshot(entity, productMetadata);

        reviewRepo.delete(entity);
        reviewRepo.flush();
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
        return photos != null ? List.copyOf(photos) : List.of();
    }

    /**
     * Delete review objects only after the database transaction commits and only
     * when no remaining review (including legacy rows) references the same object.
     */
    private void scheduleReferenceSafePhotoCleanup(List<String> photos) {
        if (photos == null || photos.isEmpty()) {
            return;
        }
        List<String> candidates = List.copyOf(photos);
        Runnable cleanup = () -> deleteUnreferencedReviewPhotos(candidates);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    cleanup.run();
                }
            });
            return;
        }
        cleanup.run();
    }

    private void deleteUnreferencedReviewPhotos(List<String> candidates) {
        try {
            Set<String> referencedKeys = reviewRepo.findAllWithPhotos().stream()
                    .filter(review -> review.getPhotos() != null)
                    .flatMap(review -> review.getPhotos().stream())
                    .map(ReviewPhotoStorageService::reviewObjectKey)
                    .filter(key -> key != null)
                    .collect(Collectors.toSet());

            Map<String, String> deletableByKey = new LinkedHashMap<>();
            for (String url : candidates) {
                String key = ReviewPhotoStorageService.reviewObjectKey(url);
                if (key != null && !referencedKeys.contains(key)) {
                    deletableByKey.putIfAbsent(key, url);
                }
            }
            reviewPhotoStorageService.deletePhotos(List.copyOf(deletableByKey.values()));
        } catch (Exception exception) {
            // Database deletion is already committed; storage cleanup remains fail-safe.
            log.warn("Skipped review photo cleanup because reference verification failed: {}",
                    exception.getMessage());
        }
    }

    private static void requireExpectedVersion(ReviewEntity review, Long expectedVersion) {
        if (expectedVersion == null) {
            throw ValidationException.fromField(
                    "expectedVersion",
                    "REQUIRED",
                    "Phiên bản đánh giá không được để trống.");
        }
        if (review.getVersion() == null || !review.getVersion().equals(expectedVersion)) {
            throw new ObjectOptimisticLockingFailureException(ReviewEntity.class, review.getId());
        }
    }

    private static String validateStatus(String status) {
        if (status == null || status.isBlank()) {
            throw ValidationException.fromField(
                    "status", "REQUIRED", "Trạng thái không được để trống.");
        }
        String normalized = status.toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUSES.contains(normalized)) {
            throw ValidationException.fromField(
                    "status",
                    "INVALID",
                    "Trạng thái không hợp lệ. Chỉ chấp nhận: APPROVED, PENDING, SPAM, TRASH.");
        }
        return normalized;
    }

    private static String escapeLikePattern(String value) {
        return value
                .replace("!", "!!")
                .replace("%", "!%")
                .replace("_", "!_");
    }

    static String buildProductUrl(String baseUrl, String slug) {
        String base = normalizeSiteBaseUrl(baseUrl);
        if (slug == null || slug.isBlank()) {
            return base;
        }
        return base + "/product/" + slug.trim() + "/";
    }

    private static String normalizeSiteBaseUrl(String baseUrl) {
        String normalized = baseUrl == null ? "" : baseUrl.trim();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
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

    private Map<String, Object> toDetailMap(ReviewEntity review) {
        return toMap(
                review,
                loadProductMetadata(List.of(review)).get(review.getProductId()),
                true);
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

    private Map<String, Object> toMap(
            ReviewEntity review,
            ProductReviewMetadata productMetadata,
            boolean includeEmail
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", review.getId());
        payload.put("productId", review.getProductId());
        payload.put("productName", productMetadata != null ? productMetadata.name() : null);
        payload.put("productNameEn", productMetadata != null ? productMetadata.nameEn() : null);
        payload.put("productSlug", productMetadata != null ? productMetadata.slug() : null);
        payload.put("authorName", review.getAuthorName() != null ? review.getAuthorName() : "");
        if (includeEmail) {
            payload.put("authorEmail", review.getAuthorEmail() != null ? review.getAuthorEmail() : "");
        }
        payload.put("rating", review.getRating());
        payload.put("body", review.getBody() != null ? review.getBody() : "");
        payload.put("photos", review.getPhotos() != null ? review.getPhotos() : List.of());
        payload.put("status", review.getStatus());
        payload.put("version", review.getVersion() != null ? review.getVersion() : 0L);
        payload.put("createdAt", review.getCreatedAt() != null ? review.getCreatedAt().toString() : "");
        payload.put("updatedAt", review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
        // Automatic-moderation annotations (REVIEW_RULE_012). Null source means the review
        // has never been checked, which the admin UI renders differently from a clean pass.
        payload.put("moderationSource", review.getModerationSource());
        payload.put("moderationVerdict", review.getModerationVerdict());
        payload.put("moderationCategories",
                review.getModerationCategories() != null ? review.getModerationCategories() : List.of());
        payload.put("moderationReason", review.getModerationReason());
        payload.put("moderationCheckedAt",
                review.getModerationCheckedAt() != null ? review.getModerationCheckedAt().toString() : null);
        return payload;
    }

    private String snapshot(ReviewEntity review, ProductReviewMetadata productMetadata) {
        return writeJson(toAuditMap(review, productMetadata));
    }

    /**
     * Audit payload for an automatic block. Adds only the two machine-readable facts a
     * reviewer needs — which layer blocked and which categories fired — and deliberately
     * omits the AI's free-text reason, which can quote the comment (REVIEW_RULE_011).
     */
    private String autoModerationSnapshot(
            ReviewEntity review,
            ProductReviewMetadata productMetadata,
            ReviewModerationOutcome outcome
    ) {
        Map<String, Object> payload = new LinkedHashMap<>(toAuditMap(review, productMetadata));
        payload.put("moderationSource", outcome.source());
        payload.put("moderationCategories", outcome.categoryNames());
        return writeJson(payload);
    }

    private String deletedSnapshot(ReviewEntity review, ProductReviewMetadata productMetadata) {
        Map<String, Object> payload = new LinkedHashMap<>(toAuditMap(review, productMetadata));
        payload.put("deleted", true);
        return writeJson(payload);
    }

    private Map<String, Object> toAuditMap(
            ReviewEntity review,
            ProductReviewMetadata productMetadata
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", review.getId());
        payload.put("productId", review.getProductId());
        if (productMetadata != null) {
            payload.put("productName", productMetadata.name());
            payload.put("productSlug", productMetadata.slug());
        }
        payload.put("rating", review.getRating());
        payload.put("status", review.getStatus());
        payload.put("photoCount", review.getPhotos() != null ? review.getPhotos().size() : 0);
        payload.put("version", review.getVersion() != null ? review.getVersion() : 0L);
        payload.put("createdAt", review.getCreatedAt() != null ? review.getCreatedAt().toString() : "");
        payload.put("updatedAt", review.getUpdatedAt() != null ? review.getUpdatedAt().toString() : "");
        return payload;
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

    public record VersionedReviewId(Long id, Long expectedVersion) {}

    public record BulkReviewSkipped(Long id, String reason) {}

    public record BulkReviewResult(int affected, List<BulkReviewSkipped> skipped) {}

    private record StatusUpdateOutcome(Map<String, Object> payload, boolean changed) {}

    private record ProductReviewMetadata(String name, String nameEn, String slug) {}
}
