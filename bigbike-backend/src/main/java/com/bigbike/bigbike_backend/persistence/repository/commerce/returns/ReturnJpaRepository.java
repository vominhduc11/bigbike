package com.bigbike.bigbike_backend.persistence.repository.commerce.returns;

import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ReturnJpaRepository extends JpaRepository<ReturnEntity, UUID>,
        JpaSpecificationExecutor<ReturnEntity> {

    List<ReturnEntity> findByCustomerIdOrderByCreatedAtDesc(UUID customerId);

    List<ReturnEntity> findByOrderIdOrderByCreatedAtDesc(UUID orderId);
}
