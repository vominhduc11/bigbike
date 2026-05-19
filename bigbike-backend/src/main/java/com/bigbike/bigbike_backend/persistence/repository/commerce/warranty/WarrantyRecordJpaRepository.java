package com.bigbike.bigbike_backend.persistence.repository.commerce.warranty;

import com.bigbike.bigbike_backend.persistence.entity.commerce.warranty.WarrantyRecordEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WarrantyRecordJpaRepository
        extends JpaRepository<WarrantyRecordEntity, UUID> {

    Optional<WarrantyRecordEntity> findBySerialId(UUID serialId);

    boolean existsBySerialId(UUID serialId);

    // CAST(:q AS string) is required so Hibernate binds a null :q as VARCHAR,
    // not bytea — otherwise PostgreSQL rejects LOWER(bytea). Same pattern as
    // PageJpaRepository / ArticleJpaRepository / ProductSerialJpaRepository.
    @Query("""
        SELECT w FROM WarrantyRecordEntity w
        WHERE (:status IS NULL OR w.status = :status)
          AND (:customerId IS NULL OR w.customerId = :customerId)
          AND (:q IS NULL
               OR LOWER(w.customerEmail) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))
               OR LOWER(w.customerPhone) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')))
        ORDER BY w.createdAt DESC
        """)
    Page<WarrantyRecordEntity> search(
            @Param("status") String status,
            @Param("customerId") UUID customerId,
            @Param("q") String q,
            Pageable pageable
    );

    @Query("""
        SELECT w FROM WarrantyRecordEntity w
        WHERE w.status = 'ACTIVE' AND w.endDate <= :cutoff
        """)
    List<WarrantyRecordEntity> findExpiredBefore(@Param("cutoff") LocalDate cutoff);
}
