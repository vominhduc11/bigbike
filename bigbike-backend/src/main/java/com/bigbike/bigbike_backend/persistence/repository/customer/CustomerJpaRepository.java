package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerJpaRepository extends JpaRepository<CustomerEntity, UUID>,
        JpaSpecificationExecutor<CustomerEntity> {

    Optional<CustomerEntity> findByEmail(String email);

    Optional<CustomerEntity> findByPhone(String phone);

    /**
     * Compares the canonical digit-only/local form in the database so legacy values such as
     * {@code +84 90.123-4567} cannot bypass identity and uniqueness checks.
     */
    @Query(value = """
            SELECT c.*
            FROM customers c
            WHERE (
                CASE
                    WHEN REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') LIKE '84%'
                         AND LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) >= 11
                    THEN CONCAT('0', SUBSTRING(
                            REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 3))
                    ELSE REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')
                END
            ) = :normalizedPhone
            ORDER BY c.created_at ASC, c.id ASC
            """, nativeQuery = true)
    List<CustomerEntity> findNormalizedPhoneMatches(
            @Param("normalizedPhone") String normalizedPhone, Pageable pageable);

    default Optional<CustomerEntity> findFirstByNormalizedPhone(String normalizedPhone) {
        if (normalizedPhone == null || normalizedPhone.isBlank()) {
            return Optional.empty();
        }
        Optional<CustomerEntity> exact = findByPhone(normalizedPhone);
        if (exact.isPresent()) {
            return exact;
        }
        return findNormalizedPhoneMatches(normalizedPhone, PageRequest.of(0, 1))
                .stream()
                .findFirst();
    }

    @Query(value = """
            SELECT COUNT(*)
            FROM customers c
            WHERE c.id <> :excludedCustomerId
              AND (
                  CASE
                      WHEN REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g') LIKE '84%'
                           AND LENGTH(REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')) >= 11
                      THEN CONCAT('0', SUBSTRING(
                              REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g'), 3))
                      ELSE REGEXP_REPLACE(c.phone, '[^0-9]', '', 'g')
                  END
              ) = :normalizedPhone
            """, nativeQuery = true)
    long countByNormalizedPhoneExcludingId(
            @Param("normalizedPhone") String normalizedPhone,
            @Param("excludedCustomerId") UUID excludedCustomerId);

    Optional<CustomerEntity> findByLegacyId(Long legacyId);

    Optional<CustomerEntity> findByOauthProviderAndOauthSubject(String oauthProvider, String oauthSubject);

    // ── Admin Customers screen registered-account KPI counts ──────────────────
    @Query("""
            SELECT COUNT(c)
            FROM CustomerEntity c
            WHERE c.status = :status
              AND c.isSynthetic = false
            """)
    long countNonSyntheticByStatus(@Param("status") String status);

    @Query("""
            SELECT COUNT(c)
            FROM CustomerEntity c
            WHERE c.createdAt > :cutoff
              AND c.isSynthetic = false
            """)
    long countNonSyntheticCreatedAfter(@Param("cutoff") Instant cutoff);
}
