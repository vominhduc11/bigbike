package com.bigbike.bigbike_backend.persistence.entity.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "review_invitation_opt_outs")
public class ReviewInvitationOptOutEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "email_normalized", nullable = false, unique = true, length = 255)
    private String emailNormalized;

    @Column(nullable = false, length = 32)
    private String source = "EMAIL_LINK";

    @Column(name = "opted_out_at", nullable = false)
    private Instant optedOutAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
