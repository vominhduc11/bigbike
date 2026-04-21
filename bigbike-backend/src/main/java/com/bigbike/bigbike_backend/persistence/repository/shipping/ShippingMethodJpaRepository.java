package com.bigbike.bigbike_backend.persistence.repository.shipping;

import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingMethodEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ShippingMethodJpaRepository extends JpaRepository<ShippingMethodEntity, UUID> {

    List<ShippingMethodEntity> findByZoneId(UUID zoneId);

    List<ShippingMethodEntity> findByZoneIdAndEnabledOrderBySortOrderAsc(UUID zoneId, boolean enabled);

    List<ShippingMethodEntity> findByEnabledOrderBySortOrderAsc(boolean enabled);
}
