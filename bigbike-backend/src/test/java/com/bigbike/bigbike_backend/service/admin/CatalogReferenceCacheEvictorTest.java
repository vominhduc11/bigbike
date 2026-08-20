package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;

class CatalogReferenceCacheEvictorTest {

    @Test
    void clearsCategoryBrandAndAttributeReferenceCaches() {
        ConcurrentMapCacheManager cacheManager = new ConcurrentMapCacheManager(
                CatalogReferenceCacheEvictor.CATEGORIES,
                CatalogReferenceCacheEvictor.BRANDS,
                CatalogReferenceCacheEvictor.ATTRIBUTES);
        cacheManager.getCache(CatalogReferenceCacheEvictor.CATEGORIES).put("hit", "danh-muc");
        cacheManager.getCache(CatalogReferenceCacheEvictor.BRANDS).put("hit", "thuong-hieu");
        cacheManager.getCache(CatalogReferenceCacheEvictor.ATTRIBUTES).put("hit", "thuoc-tinh");

        new CatalogReferenceCacheEvictor(cacheManager).evictAllAfterCommit();

        assertThat(cacheManager.getCache(CatalogReferenceCacheEvictor.CATEGORIES).get("hit")).isNull();
        assertThat(cacheManager.getCache(CatalogReferenceCacheEvictor.BRANDS).get("hit")).isNull();
        assertThat(cacheManager.getCache(CatalogReferenceCacheEvictor.ATTRIBUTES).get("hit")).isNull();
    }
}
