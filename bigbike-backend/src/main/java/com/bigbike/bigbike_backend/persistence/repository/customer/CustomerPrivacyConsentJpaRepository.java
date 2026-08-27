package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerPrivacyConsentEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerPrivacyConsentJpaRepository extends JpaRepository<CustomerPrivacyConsentEntity, UUID> {

    List<CustomerPrivacyConsentEntity> findByCustomerId(UUID customerId);
}
