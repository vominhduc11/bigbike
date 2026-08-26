package com.bigbike.bigbike_backend.persistence.repository.media;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface MediaJpaRepository extends JpaRepository<MediaEntity, UUID>,
        JpaSpecificationExecutor<MediaEntity> {

    Optional<MediaEntity> findByLegacyId(Long legacyId);

    List<MediaEntity> findByLegacyIdIn(java.util.Collection<Long> legacyIds);

    Optional<MediaEntity> findFirstByFilePath(String filePath);

    List<MediaEntity> findByFilePathIn(java.util.Collection<String> filePaths);

    Optional<MediaEntity> findByContentSha256(String contentSha256);

    List<MediaEntity> findByPublicUrlIn(java.util.Collection<String> publicUrls);

    List<MediaEntity> findByStorageProvider(String storageProvider);
}
