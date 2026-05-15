package com.bigbike.bigbike_backend.service.admin;

import com.bigbike.bigbike_backend.persistence.entity.shipping.ShippingZoneEntity;
import com.bigbike.bigbike_backend.persistence.repository.shipping.ShippingZoneJpaRepository;
import java.time.Instant;
import java.util.List;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ensures the three fixed shipping zones (MB / MT / MN) always exist.
 * Idempotent: finds by region_code, upserts standard name + sort order.
 * Admin UI treats these three as the only valid zones; methods are managed within them.
 */
@Configuration
public class ShippingZoneSeeder {

    private record SeedZone(String regionCode, String name, int sortOrder) {}

    private static final List<SeedZone> SEED = List.of(
            new SeedZone("MB", "Miền Bắc", 1),
            new SeedZone("MT", "Miền Trung", 2),
            new SeedZone("MN", "Miền Nam", 3)
    );

    @Bean
    public ApplicationRunner seedShippingZones(ShippingZoneJpaRepository zoneRepo) {
        return args -> upsertSeedZones(zoneRepo);
    }

    @Transactional
    void upsertSeedZones(ShippingZoneJpaRepository zoneRepo) {
        Instant now = Instant.now();
        for (SeedZone seed : SEED) {
            ShippingZoneEntity zone = zoneRepo.findFirstByRegionCode(seed.regionCode())
                    .orElseGet(() -> {
                        ShippingZoneEntity z = new ShippingZoneEntity();
                        z.setRegionCode(seed.regionCode());
                        z.setCreatedAt(now);
                        z.setEnabled(true);
                        return z;
                    });
            zone.setName(seed.name());
            zone.setSortOrder(seed.sortOrder());
            zone.setUpdatedAt(now);
            zoneRepo.save(zone);
        }
    }
}
