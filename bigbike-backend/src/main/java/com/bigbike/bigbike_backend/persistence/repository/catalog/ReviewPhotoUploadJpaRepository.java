package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewPhotoUploadEntity;
import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewPhotoUploadJpaRepository
        extends JpaRepository<ReviewPhotoUploadEntity, String> {

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE ReviewPhotoUploadEntity u
            SET u.claimedAt = :claimedAt, u.reviewId = :reviewId
            WHERE u.objectKey = :objectKey
              AND u.productId = :productId
              AND u.claimedAt IS NULL
              AND u.reviewId IS NULL
            """)
    int claim(
            @Param("objectKey") String objectKey,
            @Param("productId") String productId,
            @Param("reviewId") Long reviewId,
            @Param("claimedAt") Instant claimedAt);

    @Query("""
            SELECT u FROM ReviewPhotoUploadEntity u
            WHERE u.reviewId IS NULL
              AND u.uploadedAt <= :cutoff
            ORDER BY u.uploadedAt ASC
            """)
    List<ReviewPhotoUploadEntity> findCleanupCandidates(@Param("cutoff") Instant cutoff);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            DELETE FROM ReviewPhotoUploadEntity u
            WHERE u.objectKey = :objectKey
              AND u.reviewId IS NULL
              AND u.uploadedAt <= :cutoff
            """)
    int deleteCleanupCandidate(
            @Param("objectKey") String objectKey,
            @Param("cutoff") Instant cutoff);
}
