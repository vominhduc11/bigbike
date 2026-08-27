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
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Immutable evidence of a new customer's agreement to a published Privacy Policy version. */
@Entity
@Table(name = "customer_privacy_consents")
@Getter
@Setter
@NoArgsConstructor
public class CustomerPrivacyConsentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Column(name = "policy_version", nullable = false, length = 32)
    private String policyVersion;

    @Column(nullable = false, length = 2)
    private String locale;

    @Column(name = "accepted_at", nullable = false)
    private Instant acceptedAt;
}
