package com.bigbike.bigbike_backend.persistence.repository.review;

import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationCampaignEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

public interface ReviewInvitationCampaignJpaRepository
        extends JpaRepository<ReviewInvitationCampaignEntity, UUID> {

    Optional<ReviewInvitationCampaignEntity> findFirstByDeactivatedAtIsNullOrderByActivatedAtDesc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from ReviewInvitationCampaignEntity c where c.deactivatedAt is null")
    Optional<ReviewInvitationCampaignEntity> findActiveForUpdate();
}
