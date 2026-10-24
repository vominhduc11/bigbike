package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.api.admin.dto.SetHomepageBlocksRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.repository.catalog.PublishedProductListingCache;
import com.bigbike.bigbike_backend.service.admin.support.AuditLogFactory;
import com.bigbike.bigbike_backend.service.audit.AuditLogWriter;
import com.bigbike.bigbike_backend.service.web.WebRevalidationService;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class HomepageBlockMutationServiceTest {

    private final ProductJpaRepository products = mock(ProductJpaRepository.class);
    private final CatalogReadRepository catalog = mock(CatalogReadRepository.class);
    private final WebRevalidationService web = mock(WebRevalidationService.class);
    private final PublishedProductListingCache listingCache = new PublishedProductListingCache();
    private final Product previousProduct = mock(Product.class);
    private final Product nextProduct = mock(Product.class);
    private final AtomicReference<List<Product>> stored = new AtomicReference<>(List.of(previousProduct));
    private HomepageBlockMutationService service;
    private ProductEntity previous;
    private ProductEntity next;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        ObjectProvider<ProductJpaRepository> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(products);
        var evictor = new CatalogReferenceCacheEvictor(new ConcurrentMapCacheManager(), listingCache);
        service = new HomepageBlockMutationService(provider, catalog, web,
                mock(AuditLogWriter.class), new AuditLogFactory(), evictor);
        previous = product("previous", HomepageBlock.FEATURED_GRID);
        next = product("next", HomepageBlock.NONE);
        when(products.findByHomepageBlockIn(any())).thenReturn(List.of(previous));
        when(products.findAllById(any())).thenReturn(List.of(previous, next));
        when(catalog.findProductById("next")).thenReturn(Optional.of(nextProduct));
        for (String locale : List.of("vi", "en")) {
            assertThat(listingCache.get(locale, stored::get)).containsExactly(previousProduct);
        }
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
    }

    @AfterEach
    void clearTransaction() {
        TransactionSynchronizationManager.clear();
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void committedReplacementRefreshesBothLocalesBeforeWebReadsAgain(boolean clearAll) {
        List<String> selection = clearAll ? List.of() : List.of("next");
        List<Product> expected = clearAll ? List.of() : List.of(nextProduct);
        doAnswer(invocation -> {
            stored.set(expected);
            return invocation.getArgument(0);
        }).when(products).saveAll(any());

        // Mô phỏng lần đọc lại do web thực hiện sau commit: phải nhận danh sách mới,
        // kể cả khi cache VI và EN đều đã được nạp trước khi lưu.
        doAnswer(invocation -> {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    for (String locale : List.of("vi", "en")) {
                        assertThat(listingCache.get(locale, stored::get)).isEqualTo(expected);
                    }
                }
            });
            return null;
        }).when(web).revalidate("products");

        assertThat(service.setHomepageBlocks(new SetHomepageBlocksRequest(selection), UUID.randomUUID()))
                .isEqualTo(expected);
        for (String locale : List.of("vi", "en")) {
            assertThat(listingCache.get(locale, stored::get)).containsExactly(previousProduct);
        }

        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        for (String locale : List.of("vi", "en")) {
            assertThat(listingCache.get(locale, stored::get)).isEqualTo(expected);
        }
        assertThat(previous.getHomepageBlock()).isEqualTo(HomepageBlock.NONE);
        assertThat(previous.getHomepageOrder()).isNull();
        if (!clearAll) {
            assertThat(next.getHomepageBlock()).isEqualTo(HomepageBlock.FEATURED_GRID);
            assertThat(next.getHomepageOrder()).isZero();
        }
    }

    @Test
    void rollbackKeepsTheExistingListingSnapshots() {
        service.setHomepageBlocks(new SetHomepageBlocksRequest(List.of("next")), UUID.randomUUID());
        stored.set(List.of(nextProduct));
        TransactionSynchronizationManager.getSynchronizations().forEach(
                callback -> callback.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK));
        for (String locale : List.of("vi", "en")) {
            assertThat(listingCache.get(locale, stored::get)).containsExactly(previousProduct);
        }
    }

    @Test
    void rejectedUnpublishedSelectionLeavesCachesAndWebUntouched() {
        next.setPublishStatus(PublishStatus.DRAFT);
        assertThatThrownBy(() -> service.setHomepageBlocks(
                new SetHomepageBlocksRequest(List.of("next")), UUID.randomUUID()))
                .isInstanceOf(ValidationException.class);
        assertThat(TransactionSynchronizationManager.getSynchronizations()).isEmpty();
        verifyNoInteractions(web);
        stored.set(List.of(nextProduct));
        for (String locale : List.of("vi", "en")) {
            assertThat(listingCache.get(locale, stored::get)).containsExactly(previousProduct);
        }
    }

    private static ProductEntity product(String id, HomepageBlock block) {
        ProductEntity entity = new ProductEntity();
        entity.setId(id);
        entity.setPublishStatus(PublishStatus.PUBLISHED);
        entity.setHomepageBlock(block);
        entity.setHomepageOrder(block == HomepageBlock.FEATURED_GRID ? 0 : null);
        return entity;
    }
}
