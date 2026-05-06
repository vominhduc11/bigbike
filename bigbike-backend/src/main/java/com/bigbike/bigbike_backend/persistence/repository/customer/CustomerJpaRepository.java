package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CustomerJpaRepository extends JpaRepository<CustomerEntity, UUID>,
        JpaSpecificationExecutor<CustomerEntity> {

    Optional<CustomerEntity> findByEmail(String email);

    Optional<CustomerEntity> findByPhone(String phone);

    Optional<CustomerEntity> findByLegacyId(Long legacyId);
}
