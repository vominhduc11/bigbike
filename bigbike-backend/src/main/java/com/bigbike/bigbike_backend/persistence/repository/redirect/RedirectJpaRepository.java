package com.bigbike.bigbike_backend.persistence.repository.redirect;

import com.bigbike.bigbike_backend.persistence.entity.redirect.RedirectEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RedirectJpaRepository extends JpaRepository<RedirectEntity, UUID> {

    Optional<RedirectEntity> findBySourcePattern(String sourcePattern);

    List<RedirectEntity> findByEnabled(boolean enabled);
}
