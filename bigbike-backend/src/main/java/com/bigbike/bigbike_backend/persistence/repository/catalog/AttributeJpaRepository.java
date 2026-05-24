package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AttributeJpaRepository extends JpaRepository<AttributeEntity, String> {
    Optional<AttributeEntity> findByCode(String code);
    List<AttributeEntity> findAllByOrderByNameAsc();
}
