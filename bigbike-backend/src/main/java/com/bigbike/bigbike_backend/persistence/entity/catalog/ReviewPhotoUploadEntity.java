package com.bigbike.bigbike_backend.persistence.entity.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "review_photo_uploads")
@Getter
@Setter
public class ReviewPhotoUploadEntity {

    @Id
    @Column(name = "object_key", length = 500)
    private String objectKey;

    @Column(name = "public_url", nullable = false, unique = true, length = 600)
    private String publicUrl;

    @Column(name = "product_id", nullable = false, length = 64)
    private String productId;

    @Column(name = "uploaded_at", nullable = false)
    private Instant uploadedAt;

    @Column(name = "claimed_at")
    private Instant claimedAt;

    @Column(name = "review_id")
    private Long reviewId;
}
