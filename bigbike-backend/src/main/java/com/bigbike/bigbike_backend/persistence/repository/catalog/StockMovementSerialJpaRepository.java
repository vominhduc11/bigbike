package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.StockMovementSerialEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StockMovementSerialJpaRepository extends JpaRepository<StockMovementSerialEntity, UUID> {

    long countByMovementId(UUID movementId);

    @Query("SELECT s.serialNumber FROM StockMovementSerialEntity s WHERE s.serialNumber IN :serials")
    List<String> findExistingSerialNumbers(@Param("serials") List<String> serials);
}
