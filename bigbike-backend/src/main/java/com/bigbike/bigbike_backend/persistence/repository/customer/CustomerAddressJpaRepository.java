package com.bigbike.bigbike_backend.persistence.repository.customer;

import com.bigbike.bigbike_backend.persistence.entity.customer.CustomerAddressEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CustomerAddressJpaRepository extends JpaRepository<CustomerAddressEntity, UUID> {

    List<CustomerAddressEntity> findByCustomerId(UUID customerId);

    List<CustomerAddressEntity> findByCustomerIdAndType(UUID customerId, String type);

    java.util.Optional<CustomerAddressEntity> findByIdAndCustomerId(UUID id, UUID customerId);

    /** Atomically clears the default flag for all addresses of a given type — avoids race conditions. */
    @Modifying
    @Query("UPDATE CustomerAddressEntity a SET a.isDefault = false WHERE a.customer.id = :customerId AND a.type = :type")
    void clearDefaultByCustomerIdAndType(@Param("customerId") UUID customerId, @Param("type") String type);
}
