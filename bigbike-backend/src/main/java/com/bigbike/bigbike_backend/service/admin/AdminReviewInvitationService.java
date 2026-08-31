package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewInvitationItemResponse;
import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewInvitationOptOutResponse;
import com.bigbike.bigbike_backend.api.admin.dto.review.AdminReviewInvitationSummaryResponse;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationDeliveryEntity;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationOptOutEntity;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDailyQuotaJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationDeliveryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationItemJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.review.ReviewInvitationOptOutJpaRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.review.invitation.ReviewInvitationClock;
import com.bigbike.bigbike_backend.service.review.invitation.ReviewInvitationService;
import com.bigbike.bigbike_backend.service.review.invitation.ReviewInvitationSettings;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AdminReviewInvitationService {

    private final ReviewInvitationDeliveryJpaRepository deliveryRepository;
    private final ReviewInvitationItemJpaRepository itemRepository;
    private final ReviewInvitationOptOutJpaRepository optOutRepository;
    private final ReviewInvitationDailyQuotaJpaRepository quotaRepository;
    private final ReviewInvitationSettings settings;
    private final ReviewInvitationClock clock;
    private final ReviewInvitationService invitationService;

    @Transactional(readOnly = true)
    public AdminReviewInvitationSummaryResponse summary() {
        ReviewInvitationSettings.Snapshot snapshot = settings.get();
        int attemptedToday = quotaRepository.findById(clock.todayInVietnam())
                .map(quota -> quota.getAttemptCount())
                .orElse(0);
        return new AdminReviewInvitationSummaryResponse(
                deliveryRepository.countByStatus(ReviewInvitationStatus.PENDING),
                deliveryRepository.countByStatus(ReviewInvitationStatus.SENT),
                deliveryRepository.countByStatus(ReviewInvitationStatus.FAILED),
                deliveryRepository.countByStatus(ReviewInvitationStatus.UNCERTAIN),
                deliveryRepository.countByStatus(ReviewInvitationStatus.SKIPPED),
                optOutRepository.count(),
                attemptedToday,
                snapshot.dailyLimit(),
                snapshot.enabled(),
                snapshot.delayDays());
    }

    @Transactional(readOnly = true)
    public PageResult<AdminReviewInvitationItemResponse> list(
            int page, int size, String status, String q) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = Math.max(1, Math.min(100, size));
        ReviewInvitationStatus parsedStatus = parseStatus(status);
        Specification<ReviewInvitationDeliveryEntity> specification = deliverySpecification(parsedStatus, q);
        Page<ReviewInvitationDeliveryEntity> result = deliveryRepository.findAll(
                specification,
                PageRequest.of(normalizedPage - 1, normalizedSize,
                        Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        List<AdminReviewInvitationItemResponse> items = result.getContent().stream()
                .map(this::toResponse)
                .toList();
        return new PageResult<>(items, normalizedPage, normalizedSize,
                result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public PageResult<AdminReviewInvitationOptOutResponse> listOptOuts(
            int page, int size, String q) {
        int normalizedPage = Math.max(1, page);
        int normalizedSize = Math.max(1, Math.min(100, size));
        Specification<ReviewInvitationOptOutEntity> specification = optOutSpecification(q);
        Page<ReviewInvitationOptOutEntity> result = optOutRepository.findAll(
                specification,
                PageRequest.of(normalizedPage - 1, normalizedSize,
                        Sort.by(Sort.Order.desc("optedOutAt"), Sort.Order.desc("id"))));
        List<AdminReviewInvitationOptOutResponse> items = result.getContent().stream()
                .map(row -> new AdminReviewInvitationOptOutResponse(
                        row.getEmail(), row.getOptedOutAt(), row.getSource()))
                .toList();
        return new PageResult<>(items, normalizedPage, normalizedSize,
                result.getTotalElements(), result.getTotalPages());
    }

    public void skipRefunded(UUID deliveryId) {
        invitationService.skipRefunded(deliveryId);
    }

    private AdminReviewInvitationItemResponse toResponse(ReviewInvitationDeliveryEntity row) {
        return new AdminReviewInvitationItemResponse(
                row.getId(), row.getOrderId(), row.getOrderNumber(), row.getRecipientEmail(),
                row.getLocale(), row.getStatus().name(), row.getCompletedAt(), row.getDueAt(),
                row.getAttemptedAt(), row.getProviderAcceptedAt(), row.getSkipReason(),
                row.getFailureCode(), row.getFailureMessage(),
                itemRepository.countByDeliveryId(row.getId()),
                itemRepository.countByDeliveryIdAndReviewedAtIsNotNull(row.getId()),
                row.getCreatedAt());
    }

    private static ReviewInvitationStatus parseStatus(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return ReviewInvitationStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw ValidationException.fromField(
                    "status", "INVALID", "Trạng thái thư mời không hợp lệ.");
        }
    }

    private static Specification<ReviewInvitationDeliveryEntity> deliverySpecification(
            ReviewInvitationStatus status, String q) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            if (q != null && !q.isBlank()) {
                String pattern = "%" + escapeLike(q.trim().toLowerCase(Locale.ROOT)) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("orderNumber")), pattern, '!'),
                        cb.like(cb.lower(root.get("recipientEmail")), pattern, '!')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static Specification<ReviewInvitationOptOutEntity> optOutSpecification(String q) {
        return (root, query, cb) -> {
            if (q == null || q.isBlank()) {
                return cb.conjunction();
            }
            String pattern = "%" + escapeLike(q.trim().toLowerCase(Locale.ROOT)) + "%";
            return cb.like(cb.lower(root.get("email")), pattern, '!');
        };
    }

    private static String escapeLike(String value) {
        return value.replace("!", "!!").replace("%", "!%").replace("_", "!_");
    }
}
