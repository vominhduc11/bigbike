package com.bigbike.bigbike_backend.persistence.repository.media;

import com.bigbike.bigbike_backend.persistence.entity.media.MediaEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaJpaRepository extends JpaRepository<MediaEntity, UUID>,
        JpaSpecificationExecutor<MediaEntity> {

    Optional<MediaEntity> findByLegacyId(Long legacyId);

    List<MediaEntity> findByLegacyIdIn(java.util.Collection<Long> legacyIds);

    Optional<MediaEntity> findFirstByFilePath(String filePath);

    List<MediaEntity> findByFilePathIn(java.util.Collection<String> filePaths);

    Optional<MediaEntity> findByContentSha256(String contentSha256);

    List<MediaEntity> findByPublicUrlIn(java.util.Collection<String> publicUrls);

    /** Scalar projection avoids loading filenames, metadata and responsive-size JSON on public reads. */
    interface PublicImageDimensions {
        String getPublicUrl();
        Integer getWidth();
        Integer getHeight();
    }

    @Query("select m.publicUrl as publicUrl, m.width as width, m.height as height "
            + "from MediaEntity m where m.publicUrl in :publicUrls")
    List<PublicImageDimensions> findImageDimensionsByPublicUrlIn(
            @Param("publicUrls") java.util.Collection<String> publicUrls);

    List<MediaEntity> findByStorageProvider(String storageProvider);
}
