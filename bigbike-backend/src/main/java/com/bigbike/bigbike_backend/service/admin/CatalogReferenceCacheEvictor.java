package com.bigbike.bigbike_backend.service.admin;

import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Chỉ xoá đệm khi giao dịch lưu danh mục đã thành công, không xoá khi giao dịch bị hoàn tác. */
@Component
@RequiredArgsConstructor
@Slf4j
public class CatalogReferenceCacheEvictor {

    public static final String CATEGORIES = "catalog-reference-categories";
    public static final String BRANDS = "catalog-reference-brands";
    public static final String ATTRIBUTES = "catalog-reference-attributes";

    private final CacheManager cacheManager;

    public void evictAllAfterCommit() {
        Runnable eviction = this::evictAll;
        if (TransactionSynchronizationManager.isSynchronizationActive()
                && TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    eviction.run();
                }
            });
            return;
        }
        eviction.run();
    }

    private void evictAll() {
        for (String name : List.of(CATEGORIES, BRANDS, ATTRIBUTES)) {
            Cache cache = cacheManager.getCache(name);
            if (cache == null) {
                continue;
            }
            try {
                cache.clear();
            } catch (RuntimeException exception) {
                log.warn("Không thể xoá Redis cache {} sau khi lưu catalog; lần đọc sau sẽ tự hết hạn.", name, exception);
            }
        }
    }
}
