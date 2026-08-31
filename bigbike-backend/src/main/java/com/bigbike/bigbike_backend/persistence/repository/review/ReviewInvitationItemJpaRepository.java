package com.bigbike.bigbike_backend.persistence.repository.review;

import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationItemEntity;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewInvitationItemJpaRepository
        extends JpaRepository<ReviewInvitationItemEntity, UUID> {

    List<ReviewInvitationItemEntity> findByDeliveryIdOrderByCreatedAtAsc(UUID deliveryId);

    long countByDeliveryId(UUID deliveryId);

    long countByDeliveryIdAndReviewedAtIsNotNull(UUID deliveryId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from ReviewInvitationItemEntity i where i.inviteTokenHash = :tokenHash")
    Optional<ReviewInvitationItemEntity> findByInviteTokenHashForUpdate(
            @Param("tokenHash") String tokenHash);

    @Query(value = """
            select exists(
                select 1
                from review_invitation_items item
                join review_invitation_deliveries delivery on delivery.id = item.delivery_id
                where item.product_id = :productId
                  and delivery.recipient_email_normalized = :normalizedEmail
                  and item.reviewed_at is not null
            )
            """, nativeQuery = true)
    boolean existsReviewedByRecipientAndProduct(
            @Param("normalizedEmail") String normalizedEmail,
            @Param("productId") String productId);

    @Modifying
    @Query(value = """
            update review_invitation_items item
            set reviewed_at = coalesce(item.reviewed_at, :reviewedAt),
                review_id = coalesce(item.review_id, :reviewId)
            from review_invitation_deliveries delivery
            where delivery.id = item.delivery_id
              and delivery.recipient_email_normalized = :normalizedEmail
              and item.product_id = :productId
              and item.reviewed_at is null
            """, nativeQuery = true)
    int markReviewedForRecipientAndProduct(
            @Param("normalizedEmail") String normalizedEmail,
            @Param("productId") String productId,
            @Param("reviewId") Long reviewId,
            @Param("reviewedAt") java.time.Instant reviewedAt);
}
