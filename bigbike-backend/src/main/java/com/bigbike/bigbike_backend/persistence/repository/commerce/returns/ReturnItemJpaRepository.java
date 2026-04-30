package com.bigbike.bigbike_backend.persistence.repository.commerce.returns;

import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReturnItemJpaRepository extends JpaRepository<ReturnItemEntity, UUID> {

    List<ReturnItemEntity> findByReturnId(UUID returnId);
}
