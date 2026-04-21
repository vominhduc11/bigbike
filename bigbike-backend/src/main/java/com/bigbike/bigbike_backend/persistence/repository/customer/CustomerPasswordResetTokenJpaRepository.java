package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerPasswordResetTokenEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerPasswordResetTokenJpaRepository extends JpaRepository<CustomerPasswordResetTokenEntity, UUID> {

    Optional<CustomerPasswordResetTokenEntity> findByTokenHash(String tokenHash);

    void deleteByCustomerId(UUID customerId);
}
