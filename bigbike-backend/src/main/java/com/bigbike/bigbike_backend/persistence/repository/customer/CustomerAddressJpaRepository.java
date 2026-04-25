package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerAddressJpaRepository extends JpaRepository<CustomerAddressEntity, UUID> {

    List<CustomerAddressEntity> findByCustomerId(UUID customerId);

    List<CustomerAddressEntity> findByCustomerIdAndType(UUID customerId, String type);

    java.util.Optional<CustomerAddressEntity> findByIdAndCustomerId(UUID id, UUID customerId);
}
