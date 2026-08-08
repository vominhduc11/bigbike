package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerOAuthLinkEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerOAuthLinkJpaRepository extends JpaRepository<CustomerOAuthLinkEntity, UUID> {

    Optional<CustomerOAuthLinkEntity> findByProviderAndSubject(String provider, String subject);

    Optional<CustomerOAuthLinkEntity> findByCustomerIdAndProvider(UUID customerId, String provider);

    List<CustomerOAuthLinkEntity> findByCustomerIdOrderByLinkedAtAsc(UUID customerId);

    long countByCustomerId(UUID customerId);

    boolean existsByCustomerId(UUID customerId);
}
