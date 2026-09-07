package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.repository.catalog.PublishedProductListingCache;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;

class CatalogReferenceCacheEvictorTest {

    @Test
    void clearsCategoryBrandAttributeReferenceCachesAndTheStorefrontListingSnapshot() {
        ConcurrentMapCacheManager cacheManager = new ConcurrentMapCacheManager(
                CatalogReferenceCacheEvictor.CATEGORIES,
                CatalogReferenceCacheEvictor.BRANDS,
                CatalogReferenceCacheEvictor.ATTRIBUTES);
        cacheManager.getCache(CatalogReferenceCacheEvictor.CATEGORIES).put("hit", "danh-muc");
        cacheManager.getCache(CatalogReferenceCacheEvictor.BRANDS).put("hit", "thuong-hieu");
        cacheManager.getCache(CatalogReferenceCacheEvictor.ATTRIBUTES).put("hit", "thuoc-tinh");

        // The storefront listing snapshot must go too, otherwise an admin edit would stay invisible
        // to customers for up to the snapshot TTL.
        PublishedProductListingCache listingCache = new PublishedProductListingCache();
        AtomicInteger loads = new AtomicInteger();
        java.util.function.Supplier<List<Product>> loader = () -> {
            loads.incrementAndGet();
            return List.of();
        };
        listingCache.get("vi", loader);
        listingCache.get("vi", loader);
        assertThat(loads.get()).as("second read must come from the snapshot").isEqualTo(1);

        new CatalogReferenceCacheEvictor(cacheManager, listingCache).evictAllAfterCommit();

        assertThat(cacheManager.getCache(CatalogReferenceCacheEvictor.CATEGORIES).get("hit")).isNull();
        assertThat(cacheManager.getCache(CatalogReferenceCacheEvictor.BRANDS).get("hit")).isNull();
        assertThat(cacheManager.getCache(CatalogReferenceCacheEvictor.ATTRIBUTES).get("hit")).isNull();
        listingCache.get("vi", loader);
        assertThat(loads.get()).as("snapshot must be reloaded after a catalogue write").isEqualTo(2);
    }
}
