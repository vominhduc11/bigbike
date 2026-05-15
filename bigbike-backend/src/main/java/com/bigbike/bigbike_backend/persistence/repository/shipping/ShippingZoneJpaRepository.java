package com.bigbike.bigbike_backend.persistence.repository.shipping;

import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingZoneEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingZoneJpaRepository extends JpaRepository<ShippingZoneEntity, UUID> {

    Optional<ShippingZoneEntity> findByLegacyId(Long legacyId);

    Optional<ShippingZoneEntity> findFirstByRegionCode(String regionCode);

    List<ShippingZoneEntity> findByEnabledOrderBySortOrderAsc(boolean enabled);
}
