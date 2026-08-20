package com.bigbike.bigbike_backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.Brand;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogReferenceCacheSerializationTest {

    @Test
    void serializesAndRestoresImmutableCatalogProjectionWithTimestamps() {
        Brand brand = new Brand(
                "brand-test", "thuong-hieu-test", "Thương hiệu thử nghiệm", null,
                null, null, null, null, true, false, null,
                Instant.parse("2026-08-20T00:00:00Z"), Instant.parse("2026-08-20T01:00:00Z"));

        var serializer = CatalogReferenceCacheConfig.catalogReferenceValueSerializer();
        byte[] serialized = serializer.serialize(List.of(brand));
        Object restored = serializer.deserialize(serialized);

        assertThat(restored).isInstanceOf(List.class);
        assertThat(((List<?>) restored).get(0)).isEqualTo(brand);
    }
}
