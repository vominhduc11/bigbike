package com.bigbike.bigbike_backend.persistence.entity.redirect;

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

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getSourcePattern() { return sourcePattern; }
    public void setSourcePattern(String sourcePattern) { this.sourcePattern = sourcePattern; }

    public String getTargetUrl() { return targetUrl; }
    public void setTargetUrl(String targetUrl) { this.targetUrl = targetUrl; }

    public String getRedirectType() { return redirectType; }
    public void setRedirectType(String redirectType) { this.redirectType = redirectType; }

    public int getStatusCode() { return statusCode; }
    public void setStatusCode(int statusCode) { this.statusCode = statusCode; }

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public long getHitCount() { return hitCount; }
    public void setHitCount(long hitCount) { this.hitCount = hitCount; }

    public Instant getLastHitAt() { return lastHitAt; }
    public void setLastHitAt(Instant lastHitAt) { this.lastHitAt = lastHitAt; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Long getLegacyId() { return legacyId; }
    public void setLegacyId(Long legacyId) { this.legacyId = legacyId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
