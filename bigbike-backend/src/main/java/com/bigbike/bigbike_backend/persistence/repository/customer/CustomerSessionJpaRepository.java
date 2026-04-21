package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerSessionEntity;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerSessionJpaRepository extends JpaRepository<CustomerSessionEntity, UUID> {

    Optional<CustomerSessionEntity> findBySessionTokenHash(String sessionTokenHash);

    Optional<CustomerSessionEntity> findByRefreshTokenHash(String refreshTokenHash);

    List<CustomerSessionEntity> findByCustomerId(UUID customerId);

    List<CustomerSessionEntity> findByCustomerIdAndStatus(UUID customerId, String status);

    List<CustomerSessionEntity> findBySessionExpiresAtBeforeAndStatus(Instant before, String status);
}
