package com.bigbike.bigbike_backend.service.review.invitation;

import com.bigbike.bigbike_backend.api.error.ConflictException;
import com.bigbike.bigbike_backend.api.error.NotFoundException;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.commerce.order.OrderEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationCampaignEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationDeliveryEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationItemEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationOptOutEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ReviewJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.commerce.order.OrderLineItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationCampaignJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDailyQuotaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDeliveryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationOptOutJpaRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewInvitationStore {

    private static final int QUEUE_BATCH_SIZE = 500;

    private final ReviewInvitationSettings settings;
    private final ReviewInvitationTokenService tokenService;
    private final ReviewInvitationCampaignJpaRepository campaignRepository;
    private final ReviewInvitationDeliveryJpaRepository deliveryRepository;
    private final ReviewInvitationItemJpaRepository itemRepository;
    private final ReviewInvitationOptOutJpaRepository optOutRepository;
    private final ReviewInvitationDailyQuotaJpaRepository quotaRepository;
    private final OrderJpaRepository orderRepository;
    private final OrderLineItemJpaRepository lineItemRepository;
    private final ProductJpaRepository productRepository;
    private final ReviewJpaRepository reviewRepository;

    @Transactional
    public int queueEligibleOrders(Instant now) {
        ReviewInvitationSettings.Snapshot snapshot = settings.get();
        if (!snapshot.enabled()) {
            return 0;
        }
        Optional<ReviewInvitationCampaignEntity> activeOptional = campaignRepository.findActiveForUpdate();
        if (activeOptional.isEmpty()) {
            return 0;
        }
        ReviewInvitationCampaignEntity campaign = activeOptional.get();
        List<OrderEntity> candidates = orderRepository.findReviewInvitationCandidates(
                campaign.getActivatedAt(), PageRequest.of(0, QUEUE_BATCH_SIZE));

        int created = 0;
        for (OrderEntity order : candidates) {
            // Keep the business cut-off in the service as a second guard even though the
            // repository query already filters it. Imported legacy rows must never become
            // eligible if that query is refactored or a test double supplies broader data.
            if (order.getLegacyId() != null
                    || !"COMPLETED".equals(order.getStatus())
                    || order.getCompletedAt() == null
                    || order.getCompletedAt().isBefore(campaign.getActivatedAt())) {
                continue;
            }
            if (deliveryRepository.existsByOrderId(order.getId())) {
                continue;
            }
            String normalizedEmail = ReviewInvitationTokenService.normalizeEmail(order.getCustomerEmail());
            if (normalizedEmail.isBlank()) {
                continue;
            }

            ReviewInvitationDeliveryEntity delivery = new ReviewInvitationDeliveryEntity();
            delivery.setCampaignId(campaign.getId());
            delivery.setOrderId(order.getId());
            delivery.setOrderNumber(order.getOrderNumber() != null
                    ? order.getOrderNumber() : order.getId().toString());
            delivery.setCustomerId(order.getCustomerId());
            delivery.setRecipientEmail(order.getCustomerEmail().trim());
            delivery.setRecipientEmailNormalized(normalizedEmail);
            delivery.setLocale(normalizeLocale(order.getLocale()));
            delivery.setCompletedAt(order.getCompletedAt());
            delivery.setDueAt(order.getCompletedAt().plus(snapshot.delayDays(), ChronoUnit.DAYS));
            delivery.setStatus(ReviewInvitationStatus.PENDING);
            delivery.setCreatedAt(now);
            delivery.setUpdatedAt(now);

            Set<String> productIds = lineItemRepository.findByOrderId(order.getId()).stream()
                    .map(line -> line.resolveProductKey())
                    .filter(productId -> productId != null && !productId.isBlank())
                    .collect(Collectors.toCollection(LinkedHashSet::new));

            if (optOutRepository.existsByEmailNormalized(normalizedEmail)) {
                skip(delivery, "OPTED_OUT", now);
            } else if (productIds.isEmpty()) {
                skip(delivery, "NO_ELIGIBLE_PRODUCTS", now);
            }
            deliveryRepository.saveAndFlush(delivery);

            int reviewedCount = 0;
            for (String productId : productIds) {
                ReviewInvitationItemEntity item = new ReviewInvitationItemEntity();
                item.setDeliveryId(delivery.getId());
                item.setProductId(productId);
                item.setCreatedAt(now);
                if (wasAlreadyReviewed(order, normalizedEmail, productId)) {
                    item.setReviewedAt(now);
                    reviewedCount++;
                }
                itemRepository.save(item);
            }
            if (!productIds.isEmpty() && reviewedCount == productIds.size()
                    && delivery.getStatus() == ReviewInvitationStatus.PENDING) {
                skip(delivery, "ALREADY_REVIEWED", now);
                deliveryRepository.save(delivery);
            }
            created++;
        }
        return created;
    }

    @Transactional
    public Optional<ReviewInvitationDispatchClaim> claimNext(
            Instant now, LocalDate vietnamDate) {
        deliveryRepository.markStaleSendingUncertain(now.minus(30, ChronoUnit.MINUTES), now);
        ReviewInvitationSettings.Snapshot snapshot = settings.get();
        if (!snapshot.enabled()) {
            deliveryRepository.skipAllPending("FEATURE_DISABLED", now);
            return Optional.empty();
        }

        Optional<ReviewInvitationCampaignEntity> activeOptional = campaignRepository.findActiveForUpdate();
        if (activeOptional.isEmpty()) {
            deliveryRepository.skipAllPending("CAMPAIGN_CLOSED", now);
            return Optional.empty();
        }
        UUID activeCampaignId = activeOptional.get().getId();

        while (true) {
            Optional<ReviewInvitationDeliveryEntity> next = deliveryRepository.findNextDueForUpdate(now);
            if (next.isEmpty()) {
                return Optional.empty();
            }
            ReviewInvitationDeliveryEntity delivery = next.get();
            if (!activeCampaignId.equals(delivery.getCampaignId())) {
                saveSkipped(delivery, "CAMPAIGN_CLOSED", now);
                continue;
            }

            OrderEntity order = orderRepository.findById(delivery.getOrderId()).orElse(null);
            if (order == null || !"COMPLETED".equals(order.getStatus())) {
                saveSkipped(delivery, "ORDER_CANCELLED", now);
                continue;
            }
            if (optOutRepository.existsByEmailNormalized(delivery.getRecipientEmailNormalized())) {
                saveSkipped(delivery, "OPTED_OUT", now);
                continue;
            }

            List<ReviewInvitationItemEntity> items = itemRepository
                    .findByDeliveryIdOrderByCreatedAtAsc(delivery.getId());
            List<String> productIds = items.stream()
                    .map(ReviewInvitationItemEntity::getProductId)
                    .distinct()
                    .toList();
            Map<String, ProductEntity> products = productRepository.findAllById(productIds).stream()
                    .collect(Collectors.toMap(ProductEntity::getId, Function.identity()));

            for (ReviewInvitationItemEntity item : items) {
                if (item.getReviewedAt() == null
                        && wasAlreadyReviewed(order, delivery.getRecipientEmailNormalized(), item.getProductId())) {
                    item.setReviewedAt(now);
                    itemRepository.save(item);
                }
            }

            List<ReviewInvitationItemEntity> eligibleItems = items.stream()
                    .filter(item -> item.getReviewedAt() == null)
                    .filter(item -> isPublicProduct(products.get(item.getProductId())))
                    .toList();
            if (eligibleItems.isEmpty()) {
                boolean allReviewed = !items.isEmpty()
                        && items.stream().allMatch(item -> item.getReviewedAt() != null);
                saveSkipped(delivery, allReviewed ? "ALREADY_REVIEWED" : "NO_ELIGIBLE_PRODUCTS", now);
                continue;
            }

            quotaRepository.ensureRow(vietnamDate, now);
            if (quotaRepository.reserveAttempt(vietnamDate, snapshot.dailyLimit(), now) == 0) {
                return Optional.empty();
            }

            List<ReviewInvitationDispatchClaim.ProductClaim> productClaims = eligibleItems.stream()
                    .map(item -> {
                        ReviewInvitationTokenService.TokenPair token = tokenService.issue();
                        item.setInviteTokenHash(token.hash());
                        itemRepository.save(item);
                        ProductEntity product = products.get(item.getProductId());
                        return new ReviewInvitationDispatchClaim.ProductClaim(
                                item.getProductId(),
                                localizedName(product, delivery.getLocale()),
                                localizedSlug(product, delivery.getLocale()),
                                token.raw());
                    })
                    .toList();
            ReviewInvitationTokenService.TokenPair unsubscribeToken = tokenService.issue();
            delivery.setUnsubscribeTokenHash(unsubscribeToken.hash());
            delivery.setStatus(ReviewInvitationStatus.SENDING);
            delivery.setAttemptedAt(now);
            delivery.setUpdatedAt(now);
            deliveryRepository.saveAndFlush(delivery);

            return Optional.of(new ReviewInvitationDispatchClaim(
                    delivery.getId(),
                    delivery.getRecipientEmail(),
                    customerName(order, delivery.getLocale()),
                    delivery.getOrderNumber(),
                    delivery.getLocale(),
                    unsubscribeToken.raw(),
                    productClaims));
        }
    }

    @Transactional
    public void completeAttempt(UUID deliveryId, boolean accepted, Instant now) {
        ReviewInvitationDeliveryEntity delivery = deliveryRepository.findByIdForUpdate(deliveryId)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy thư mời đánh giá."));
        if (delivery.getStatus() != ReviewInvitationStatus.SENDING) {
            return;
        }
        if (accepted) {
            delivery.setStatus(ReviewInvitationStatus.SENT);
            delivery.setProviderAcceptedAt(now);
            delivery.setFailureCode(null);
            delivery.setFailureMessage(null);
        } else {
            delivery.setStatus(ReviewInvitationStatus.FAILED);
            delivery.setFailureCode("MAIL_NOT_ACCEPTED");
            delivery.setFailureMessage("Hộp thư gửi không nhận thư; hệ thống không tự gửi lại.");
        }
        delivery.setUpdatedAt(now);
        deliveryRepository.save(delivery);
    }

    @Transactional
    public void unsubscribe(String rawToken, Instant now) {
        String hash = tokenService.hash(rawToken);
        ReviewInvitationDeliveryEntity delivery = deliveryRepository
                .findByUnsubscribeTokenHashForUpdate(hash)
                .orElseThrow(() -> ValidationException.fromField(
                        "token", "INVALID", "Đường dẫn từ chối không hợp lệ."));
        String normalizedEmail = delivery.getRecipientEmailNormalized();
        if (!optOutRepository.existsByEmailNormalized(normalizedEmail)) {
            ReviewInvitationOptOutEntity optOut = new ReviewInvitationOptOutEntity();
            optOut.setEmail(delivery.getRecipientEmail());
            optOut.setEmailNormalized(normalizedEmail);
            optOut.setSource("EMAIL_LINK");
            optOut.setOptedOutAt(now);
            optOut.setCreatedAt(now);
            optOutRepository.save(optOut);
        }
        deliveryRepository.skipPendingByNormalizedEmail(normalizedEmail, now);
    }

    @Transactional
    public void consumeInviteToken(
            String rawToken, String productId, Long reviewId, Instant now) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        ReviewInvitationItemEntity item = itemRepository
                .findByInviteTokenHashForUpdate(tokenService.hash(rawToken))
                .orElseThrow(() -> ValidationException.fromField(
                        "inviteToken", "INVALID", "Đường dẫn mời đánh giá không hợp lệ."));
        if (!item.getProductId().equals(productId)) {
            throw ValidationException.fromField(
                    "inviteToken", "WRONG_PRODUCT", "Đường dẫn mời không dành cho sản phẩm này.");
        }
        if (item.getReviewedAt() != null || item.getReviewId() != null) {
            throw new ConflictException("Đường dẫn mời đánh giá này đã được sử dụng.");
        }
        ReviewInvitationDeliveryEntity delivery = deliveryRepository.findById(item.getDeliveryId())
                .orElseThrow(() -> ValidationException.fromField(
                        "inviteToken", "INVALID", "Đường dẫn mời đánh giá không hợp lệ."));
        item.setReviewId(reviewId);
        item.setReviewedAt(now);
        itemRepository.save(item);
        itemRepository.markReviewedForRecipientAndProduct(
                delivery.getRecipientEmailNormalized(), productId, reviewId, now);
    }

    private boolean wasAlreadyReviewed(OrderEntity order, String normalizedEmail, String productId) {
        if (order.getCustomerId() != null
                && reviewRepository.existsByProductIdAndCustomerId(productId, order.getCustomerId())) {
            return true;
        }
        if (!normalizedEmail.isBlank()
                && reviewRepository.existsByProductIdAndNormalizedAuthorEmail(productId, normalizedEmail)) {
            return true;
        }
        return !normalizedEmail.isBlank()
                && itemRepository.existsReviewedByRecipientAndProduct(normalizedEmail, productId);
    }

    private static boolean isPublicProduct(ProductEntity product) {
        return product != null
                && product.getPublishStatus() == PublishStatus.PUBLISHED
                && !product.isDiscontinued()
                && localizedSlug(product, "vi") != null;
    }

    private static String localizedName(ProductEntity product, String locale) {
        if ("en".equals(locale) && product.getNameEn() != null && !product.getNameEn().isBlank()) {
            return product.getNameEn().trim();
        }
        return product.getName() != null && !product.getName().isBlank()
                ? product.getName().trim() : product.getId();
    }

    private static String localizedSlug(ProductEntity product, String locale) {
        if (product == null) {
            return null;
        }
        if ("en".equals(locale) && product.getSlugEn() != null && !product.getSlugEn().isBlank()) {
            return product.getSlugEn().trim();
        }
        return product.getSlug() != null && !product.getSlug().isBlank()
                ? product.getSlug().trim() : null;
    }

    private static String customerName(OrderEntity order, String locale) {
        if (order.getCustomerName() != null && !order.getCustomerName().isBlank()) {
            return order.getCustomerName().trim();
        }
        return "en".equals(locale) ? "Rider" : "Anh/chị";
    }

    private static String normalizeLocale(String locale) {
        return "en".equalsIgnoreCase(locale) ? "en" : "vi";
    }

    private static void skip(ReviewInvitationDeliveryEntity delivery, String reason, Instant now) {
        delivery.setStatus(ReviewInvitationStatus.SKIPPED);
        delivery.setSkipReason(reason);
        delivery.setUpdatedAt(now);
    }

    private void saveSkipped(ReviewInvitationDeliveryEntity delivery, String reason, Instant now) {
        skip(delivery, reason, now);
        deliveryRepository.saveAndFlush(delivery);
    }
}
