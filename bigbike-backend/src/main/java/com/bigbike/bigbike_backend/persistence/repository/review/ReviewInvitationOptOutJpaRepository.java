package com.bigbike.bigbike_backend.persistence.repository.review;

import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationOptOutEntity;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ReviewInvitationOptOutJpaRepository extends
        JpaRepository<ReviewInvitationOptOutEntity, UUID>,
        JpaSpecificationExecutor<ReviewInvitationOptOutEntity> {

    boolean existsByEmailNormalized(String emailNormalized);
}
