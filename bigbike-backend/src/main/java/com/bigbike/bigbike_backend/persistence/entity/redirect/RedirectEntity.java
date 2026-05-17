package com.bigbike.bigbike_backend.persistence.entity.redirect;

import lombok.Getter;
import lombok.Setter;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "redirects")
@Getter
@Setter
public class RedirectEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "source_pattern", nullable = false, columnDefinition = "text")
    private String sourcePattern;

    @Column(name = "target_url", nullable = false, columnDefinition = "text")
    private String targetUrl;

    @Column(name = "redirect_type", nullable = false, length = 50)
    private String redirectType;

    @Column(name = "status_code", nullable = false)
    private int statusCode = 301;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "hit_count", nullable = false)
    private long hitCount = 0;

    @Column(name = "last_hit_at")
    private Instant lastHitAt;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "legacy_id")
    private Long legacyId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

}
