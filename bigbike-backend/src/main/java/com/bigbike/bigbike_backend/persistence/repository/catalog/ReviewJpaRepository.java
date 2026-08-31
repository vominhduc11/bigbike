package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewJpaRepository extends JpaRepository<ReviewEntity, Long> {

    boolean existsByProductIdAndCustomerId(String productId, UUID customerId);

    @Query(value = """
            select exists(
                select 1 from reviews
                where product_id = :productId
                  and author_email is not null
                  and lower(trim(author_email)) = :normalizedEmail
            )
            """, nativeQuery = true)
    boolean existsByProductIdAndNormalizedAuthorEmail(
            @Param("productId") String productId,
            @Param("normalizedEmail") String normalizedEmail);

    Optional<ReviewEntity> findByLegacyId(Long legacyId);

    Page<ReviewEntity> findByProductIdAndStatus(String productId, String status, Pageable pageable);

    Page<ReviewEntity> findByProductIdAndStatusAndRating(
            String productId, String status, BigDecimal rating, Pageable pageable);

    @Query("""
            SELECT AVG(r.rating) AS avgRating, COUNT(r) AS totalReviews
            FROM ReviewEntity r
            WHERE r.productId = :productId
              AND r.status = :status
            """)
    ReviewAggregate findAggregateByProductIdAndStatus(
            @Param("productId") String productId,
            @Param("status") String status);

    // Postgres cannot infer the type of a JDBC null param inside lower(?)/upper(?), so it
    // throws "function lower(bytea) does not exist". The service layer normalises status/q to
    // empty strings and the WHERE clause short-circuits on '' instead of NULL.
    // strictEnglish = true (admin VI/EN switch ở chế độ EN): chỉ giữ review của sản phẩm
    // đã có name_en — ẩn review của SP chưa dịch. Lọc ở tầng query để phân trang đúng.
    @Query("""
            SELECT r FROM ReviewEntity r
            WHERE (:status = '' OR UPPER(r.status) = UPPER(:status))
              AND (:rating = 0 OR r.rating = :rating)
              AND (:q = ''
                   OR LOWER(r.authorName) LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!'
                   OR LOWER(r.body)       LIKE LOWER(CONCAT('%', :q, '%')) ESCAPE '!')
              AND (:strictEnglish = FALSE
                   OR EXISTS (SELECT 1 FROM ProductEntity p
                              WHERE p.id = r.productId
                                AND p.nameEn IS NOT NULL AND TRIM(p.nameEn) <> ''))
            """)
    Page<ReviewEntity> findByFilters(
            @Param("status") String status,
            @Param("q") String q,
            @Param("rating") BigDecimal rating,
            @Param("strictEnglish") boolean strictEnglish,
            Pageable pageable);

    @Query("""
            SELECT AVG(r.rating) AS avgRating, COUNT(r) AS totalReviews
            FROM ReviewEntity r
            WHERE r.status = :status
            """)
    ReviewAggregate findGlobalAggregateByStatus(@Param("status") String status);

    @Query("""
            SELECT r.rating, COUNT(r)
            FROM ReviewEntity r
            WHERE r.status = :status
            GROUP BY r.rating
            """)
    List<Object[]> findGlobalRatingBreakdownByStatus(@Param("status") String status);

    long countByStatus(String status);

    long countByStatusAndRating(String status, BigDecimal rating);

    /**
     * How many AI calls the moderator has already spent since {@code since} (REVIEW_RULE_013).
     *
     * <p>The annotation columns are the ledger — one row marked {@code AI} is exactly one
     * paid call — so the daily budget needs no counter table of its own and survives a
     * restart. Rows blocked by the banned-word layer carry {@code RULE} and are excluded
     * here because they never cost anything.
     */
    long countByModerationSourceAndModerationCheckedAtGreaterThanEqual(
            String moderationSource, Instant since);

    @Query("""
            SELECT r FROM ReviewEntity r
            WHERE r.productId = :productId
              AND r.createdAt > :since
            """)
    List<ReviewEntity> findRecentByProductId(
            @Param("productId") String productId,
            @Param("since") Instant since);

    /**
     * Reviews that currently reference at least one photo. Cleanup code intentionally
     * checks object keys in Java so both canonical relative URLs and legacy absolute
     * URLs resolve to the same MinIO object.
     */
    @Query("""
            SELECT r FROM ReviewEntity r
            WHERE r.photos IS NOT NULL
            """)
    List<ReviewEntity> findAllWithPhotos();

    /**
     * Approved-review count grouped by star rating. Each row is
     * {@code [rating, count]}; star values with no reviews are simply absent.
     */
    @Query("""
            SELECT r.rating, COUNT(r)
            FROM ReviewEntity r
            WHERE r.productId = :productId
              AND r.status = :status
            GROUP BY r.rating
            """)
    List<Object[]> findRatingBreakdownByProductIdAndStatus(
            @Param("productId") String productId,
            @Param("status") String status);

    interface ReviewAggregate {
        Double getAvgRating();
        Long getTotalReviews();
    }
}
