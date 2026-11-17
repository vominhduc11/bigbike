package com.bigbike.bigbike_backend.persistence.repository.settings;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface SiteSettingJpaRepository extends JpaRepository<SiteSettingEntity, UUID> {

    Optional<SiteSettingEntity> findBySettingKey(String settingKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM SiteSettingEntity s WHERE s.settingKey = :key")
    Optional<SiteSettingEntity> findBySettingKeyForUpdate(@Param("key") String key);

    List<SiteSettingEntity> findBySettingGroup(String settingGroup);

    List<SiteSettingEntity> findByIsPublic(boolean isPublic);
}
