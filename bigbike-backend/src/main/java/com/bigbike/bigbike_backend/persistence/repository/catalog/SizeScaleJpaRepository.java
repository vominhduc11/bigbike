package com.bigbike.bigbike_backend.persistence.repository.catalog;

import com.bigbike.bigbike_backend.persistence.entity.catalog.SizeScaleEntity;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SizeScaleJpaRepository extends JpaRepository<SizeScaleEntity, String> {

    Optional<SizeScaleEntity> findByCode(String code);

    @Query("select distinct s from SizeScaleEntity s join fetch s.group where s.active = true and s.group.active = true order by s.sortOrder, s.code")
    List<SizeScaleEntity> findAllActiveWithGroup();

    @Query("select distinct s from SizeScaleEntity s join fetch s.group order by s.sortOrder, s.code")
    List<SizeScaleEntity> findAllWithGroup();
}
