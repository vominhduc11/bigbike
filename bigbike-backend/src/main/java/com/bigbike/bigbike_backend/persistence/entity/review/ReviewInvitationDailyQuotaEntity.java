package com.bigbike.bigbike_backend.persistence.entity.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "review_invitation_daily_quotas")
public class ReviewInvitationDailyQuotaEntity {

    @Id
    @Column(name = "send_date")
    private LocalDate sendDate;

    @Column(name = "attempt_count", nullable = false)
    private int attemptCount;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
