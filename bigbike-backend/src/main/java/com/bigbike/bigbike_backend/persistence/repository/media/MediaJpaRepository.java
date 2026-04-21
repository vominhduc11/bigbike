package com.bigbike.bigbike_backend.persistence.repository.media;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaJpaRepository extends JpaRepository<MediaEntity, UUID> {

    Optional<MediaEntity> findByLegacyId(Long legacyId);

    List<MediaEntity> findByStorageProvider(String storageProvider);
}
