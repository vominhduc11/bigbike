package com.bigbike.bigbike_backend.persistence.repository.media;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaFolderEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MediaFolderJpaRepository extends JpaRepository<MediaFolderEntity, UUID> {
    Optional<MediaFolderEntity> findBySlug(String slug);
    boolean existsBySlug(String slug);
}
