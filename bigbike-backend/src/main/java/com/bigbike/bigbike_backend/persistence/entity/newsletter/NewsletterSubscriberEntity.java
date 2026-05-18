package com.bigbike.bigbike_backend.persistence.entity.newsletter;

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

/** Một email đăng ký nhận tin từ form ở chân trang storefront. */
@Entity
@Table(name = "newsletter_subscribers")
@Getter
@Setter
public class NewsletterSubscriberEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
