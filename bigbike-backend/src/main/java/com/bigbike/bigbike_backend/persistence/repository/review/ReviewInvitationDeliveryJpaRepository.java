package com.bigbike.bigbike_backend.persistence.repository.review;

import com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus;
import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationDeliveryEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewInvitationDeliveryJpaRepository extends
        JpaRepository<ReviewInvitationDeliveryEntity, UUID>,
        JpaSpecificationExecutor<ReviewInvitationDeliveryEntity> {

    boolean existsByOrderId(UUID orderId);

    long countByStatus(ReviewInvitationStatus status);

    Optional<ReviewInvitationDeliveryEntity> findByUnsubscribeTokenHash(String unsubscribeTokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ReviewInvitationDeliveryEntity d where d.id = :id")
    Optional<ReviewInvitationDeliveryEntity> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from ReviewInvitationDeliveryEntity d where d.unsubscribeTokenHash = :tokenHash")
    Optional<ReviewInvitationDeliveryEntity> findByUnsubscribeTokenHashForUpdate(
            @Param("tokenHash") String tokenHash);

    @Query(value = """
            select * from review_invitation_deliveries
            where status = 'PENDING' and due_at <= :now
            order by due_at, created_at, id
            for update skip locked
            limit 1
            """, nativeQuery = true)
    Optional<ReviewInvitationDeliveryEntity> findNextDueForUpdate(@Param("now") Instant now);

    @Modifying
    @Query("""
            update ReviewInvitationDeliveryEntity d
            set d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.SKIPPED,
                d.skipReason = :reason, d.updatedAt = :now
            where d.campaignId = :campaignId
              and d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.PENDING
            """)
    int skipPendingByCampaign(
            @Param("campaignId") UUID campaignId,
            @Param("reason") String reason,
            @Param("now") Instant now);

    @Modifying
    @Query("""
            update ReviewInvitationDeliveryEntity d
            set d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.SKIPPED,
                d.skipReason = :reason, d.updatedAt = :now
            where d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.PENDING
            """)
    int skipAllPending(@Param("reason") String reason, @Param("now") Instant now);

    @Modifying
    @Query(value = """
            update review_invitation_deliveries
            set due_at = completed_at + (:delayDays * interval '1 day'),
                updated_at = :now
            where campaign_id = :campaignId and status = 'PENDING'
            """, nativeQuery = true)
    int recalculatePendingDueDates(
            @Param("campaignId") UUID campaignId,
            @Param("delayDays") int delayDays,
            @Param("now") Instant now);

    @Modifying
    @Query("""
            update ReviewInvitationDeliveryEntity d
            set d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.SKIPPED,
                d.skipReason = 'OPTED_OUT', d.updatedAt = :now
            where d.recipientEmailNormalized = :email
              and d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.PENDING
            """)
    int skipPendingByNormalizedEmail(@Param("email") String email, @Param("now") Instant now);

    @Modifying
    @Query("""
            update ReviewInvitationDeliveryEntity d
            set d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.UNCERTAIN,
                d.failureCode = 'STALE_SENDING',
                d.failureMessage = 'Không xác định được kết quả gửi; hệ thống không gửi lại.',
                d.updatedAt = :now
            where d.status = com.bigbike.bigbike_backend.domain.review.ReviewInvitationStatus.SENDING
              and d.attemptedAt < :cutoff
            """)
    int markStaleSendingUncertain(@Param("cutoff") Instant cutoff, @Param("now") Instant now);

    @Query("select d from ReviewInvitationDeliveryEntity d where d.id in :ids")
    List<ReviewInvitationDeliveryEntity> findAllByIds(@Param("ids") List<UUID> ids);
}
