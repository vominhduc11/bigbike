package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEmailVerificationTokenEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerEmailVerificationTokenJpaRepository extends JpaRepository<CustomerEmailVerificationTokenEntity, UUID> {

    Optional<CustomerEmailVerificationTokenEntity> findByTokenHash(String tokenHash);

    void deleteByCustomerId(UUID customerId);
}
