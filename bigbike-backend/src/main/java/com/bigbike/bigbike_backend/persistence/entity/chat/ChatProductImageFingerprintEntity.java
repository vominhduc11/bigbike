package com.bigbike.bigbike_backend.persistence.entity.chat;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Local visual fingerprint for one public catalog image. Customer-image fingerprints are never
 * persisted; they live only for the duration of one comparison call.
 */
@Entity
@Table(name = "chat_product_image_fingerprints")
@Getter
@Setter
@NoArgsConstructor
public class ChatProductImageFingerprintEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "product_id", nullable = false, length = 64)
    private String productId;

    @Column(name = "media_id")
    private UUID mediaId;

    @Column(name = "image_ref", nullable = false, length = 512)
    private String imageRef;

    @Column(name = "source_version_hash", nullable = false, length = 64)
    private String sourceVersionHash;

    @Column(name = "fingerprint_version", nullable = false, length = 40)
    private String fingerprintVersion;

    @Column(name = "dhash_hex", nullable = false, length = 16)
    private String dHashHex;

    @Column(name = "color_histogram", nullable = false, columnDefinition = "text")
    private String colorHistogram;

    @Column(name = "aspect_ratio", nullable = false, precision = 12, scale = 6)
    private BigDecimal aspectRatio;

    @Column(name = "indexed_at", nullable = false)
    private Instant indexedAt;

    @PrePersist
    @PreUpdate
    void touch() {
        indexedAt = Instant.now();
    }
}
