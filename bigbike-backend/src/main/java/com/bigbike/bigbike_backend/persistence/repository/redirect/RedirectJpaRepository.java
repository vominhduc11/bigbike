package com.bigbike.bigbike_backend.persistence.repository.redirect;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RedirectJpaRepository extends JpaRepository<RedirectEntity, UUID>,
        JpaSpecificationExecutor<RedirectEntity> {

    Optional<RedirectEntity> findBySourcePattern(String sourcePattern);

    List<RedirectEntity> findByEnabled(boolean enabled);

    @Modifying
    @Query("UPDATE RedirectEntity r SET r.hitCount = r.hitCount + 1, r.lastHitAt = :hitAt WHERE r.id = :id")
    void incrementHitCount(@Param("id") UUID id, @Param("hitAt") java.time.Instant hitAt);
}
