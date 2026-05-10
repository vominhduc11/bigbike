package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.ReturnItemSerialEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReturnItemSerialJpaRepository
        extends JpaRepository<ReturnItemSerialEntity, UUID> {

    List<ReturnItemSerialEntity> findByReturnItemId(UUID returnItemId);

    @Query("""
        SELECT ris FROM ReturnItemSerialEntity ris
        WHERE ris.returnItemId IN (
            SELECT ri.id FROM ReturnItemEntity ri WHERE ri.returnId = :returnId
        )
        """)
    List<ReturnItemSerialEntity> findByReturnId(@Param("returnId") UUID returnId);

    boolean existsBySerialId(UUID serialId);
}
