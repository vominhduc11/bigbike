package com.bigbike.bigbike_backend.persistence.repository.commerce.returns;

import com.bigbike.bigbike_backend.persistence.entity.commerce.returns.ReturnItemEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReturnItemJpaRepository extends JpaRepository<ReturnItemEntity, UUID> {

    List<ReturnItemEntity> findByReturnId(UUID returnId);

    @Query("SELECT COALESCE(SUM(ri.quantity), 0) FROM ReturnItemEntity ri " +
           "WHERE ri.orderLineItemId = :lineItemId " +
           "AND ri.returnId IN (SELECT r.id FROM ReturnEntity r WHERE r.status <> 'REJECTED')")
    int sumNonRejectedQuantityByLineItemId(@Param("lineItemId") UUID lineItemId);
}
