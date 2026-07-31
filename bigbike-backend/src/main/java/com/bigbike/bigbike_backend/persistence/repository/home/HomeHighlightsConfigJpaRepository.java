package com.bigbike.bigbike_backend.persistence.repository.home;

import com.bigbike.bigbike_backend.persistence.entity.home.HomeHighlightsConfigEntity;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HomeHighlightsConfigJpaRepository extends JpaRepository<HomeHighlightsConfigEntity, Short> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM HomeHighlightsConfigEntity c WHERE c.id = :id")
    Optional<HomeHighlightsConfigEntity> findByIdForUpdate(@Param("id") Short id);
}
