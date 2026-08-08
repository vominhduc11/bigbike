package com.bigbike.bigbike_backend.persistence.entity.customer;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/**
 * One social identity linked to a customer (V378). A customer may hold one row per provider,
 * which is what lets Google and Facebook coexist on the same account — the single
 * {@code oauth_provider}/{@code oauth_subject} pair on {@code customers} could not.
 */
@Entity
@Table(name = "customer_oauth_links")
@Getter
@Setter
public class CustomerOAuthLinkEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    /** Stable provider-side user id (the OAuth {@code sub}). */
    @Column(name = "subject", nullable = false, length = 255)
    private String subject;

    @Column(name = "linked_at", nullable = false)
    private Instant linkedAt;
}
