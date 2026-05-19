package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReviewEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewJpaRepository extends JpaRepository<ReviewEntity, Long> {

    Optional<ReviewEntity> findByLegacyId(Long legacyId);

    Page<ReviewEntity> findByProductIdAndStatus(String productId, String status, Pageable pageable);

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
    @Query("""
            SELECT r FROM ReviewEntity r
            WHERE (:status = '' OR UPPER(r.status) = UPPER(:status))
              AND (:q = ''
                   OR LOWER(r.authorName) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(r.body)       LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY r.createdAt DESC
            """)
    Page<ReviewEntity> findByFilters(
            @Param("status") String status,
            @Param("q") String q,
            Pageable pageable);

    @Query("""
            SELECT r FROM ReviewEntity r
            WHERE r.productId = :productId
              AND r.createdAt > :since
            """)
    List<ReviewEntity> findRecentByProductId(
            @Param("productId") String productId,
            @Param("since") Instant since);

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
