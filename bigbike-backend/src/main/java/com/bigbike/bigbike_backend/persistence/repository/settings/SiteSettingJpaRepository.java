package com.bigbike.bigbike_backend.persistence.repository.settings;

import com.bigbike.bigbike_backend.persistence.entity.settings.SiteSettingEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SiteSettingJpaRepository extends JpaRepository<SiteSettingEntity, UUID> {

    Optional<SiteSettingEntity> findBySettingKey(String settingKey);

    List<SiteSettingEntity> findBySettingGroup(String settingGroup);

    List<SiteSettingEntity> findByIsPublic(boolean isPublic);
}
