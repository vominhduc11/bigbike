package com.bigbike.bigbike_backend.persistence.repository.review;

import com.bigbike.bigbike_backend.persistence.entity.review.ReviewInvitationDailyQuotaEntity;
import java.time.Instant;
import java.time.LocalDate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewInvitationDailyQuotaJpaRepository
        extends JpaRepository<ReviewInvitationDailyQuotaEntity, LocalDate> {

    @Modifying
    @Query(value = """
            insert into review_invitation_daily_quotas(send_date, attempt_count, updated_at)
            values (:sendDate, 0, :now)
            on conflict (send_date) do nothing
            """, nativeQuery = true)
    int ensureRow(@Param("sendDate") LocalDate sendDate, @Param("now") Instant now);

    @Modifying
    @Query(value = """
            update review_invitation_daily_quotas
            set attempt_count = attempt_count + 1, updated_at = :now
            where send_date = :sendDate and attempt_count < :dailyLimit
            """, nativeQuery = true)
    int reserveAttempt(
            @Param("sendDate") LocalDate sendDate,
            @Param("dailyLimit") int dailyLimit,
            @Param("now") Instant now);
}
