package com.bigbike.bigbike_backend.repository.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import com.bigbike.bigbike_backend.domain.catalog.Product;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class PublishedProductListingCacheTest {

    @Test
    void inFlightLoadCannotReplacePostInvalidationSnapshot() throws Exception {
        var cache = new PublishedProductListingCache();
        List<Product> oldProducts = List.of(mock(Product.class));
        List<Product> newProducts = List.of(mock(Product.class));
        var loaderStarted = new CountDownLatch(1);
        var releaseLoader = new CountDownLatch(1);
        var workers = Executors.newFixedThreadPool(2);
        try {
            var oldLoad = workers.submit(() -> cache.get("vi", () -> {
                loaderStarted.countDown();
                await(releaseLoader);
                return oldProducts;
            }));
            assertThat(loaderStarted.await(5, TimeUnit.SECONDS)).isTrue();

            // Invalidation and the fresh load must proceed while the original loader is blocked.
            workers.submit(cache::invalidate).get(5, TimeUnit.SECONDS);
            assertThat(cache.get("vi", () -> newProducts)).isEqualTo(newProducts);
            releaseLoader.countDown();
            assertThat(oldLoad.get(5, TimeUnit.SECONDS)).isEqualTo(oldProducts);

            assertThat(cache.get("vi", () -> {
                throw new AssertionError("The post-invalidation snapshot should remain cached");
            })).isEqualTo(newProducts);
        } finally {
            releaseLoader.countDown();
            workers.shutdownNow();
            assertThat(workers.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void invalidationDuringLoadLeavesAMissWhenNoNewSnapshotWasLoaded() throws Exception {
        var cache = new PublishedProductListingCache();
        List<Product> oldProducts = List.of(mock(Product.class));
        List<Product> newProducts = List.of(mock(Product.class));
        var loaderStarted = new CountDownLatch(1);
        var releaseLoader = new CountDownLatch(1);
        var worker = Executors.newSingleThreadExecutor();
        try {
            var oldLoad = worker.submit(() -> cache.get("en", () -> {
                loaderStarted.countDown();
                await(releaseLoader);
                return oldProducts;
            }));
            assertThat(loaderStarted.await(5, TimeUnit.SECONDS)).isTrue();
            cache.invalidate();
            releaseLoader.countDown();
            assertThat(oldLoad.get(5, TimeUnit.SECONDS)).isEqualTo(oldProducts);
            assertThat(cache.get("en", () -> newProducts)).isEqualTo(newProducts);
        } finally {
            releaseLoader.countDown();
            worker.shutdownNow();
            assertThat(worker.awaitTermination(5, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void preservesDefaultLocaleAliasesImmutableCopiesAndAllLocaleInvalidation() {
        var cache = new PublishedProductListingCache();
        Product vietnamese = mock(Product.class);
        Product english = mock(Product.class);
        var mutable = new ArrayList<>(List.of(vietnamese));
        List<Product> cached = cache.get(null, () -> mutable);
        mutable.clear();

        assertThat(cache.get(" ", () -> List.of())).containsExactly(vietnamese);
        assertThatThrownBy(cached::clear).isInstanceOf(UnsupportedOperationException.class);
        assertThat(cache.get("en", () -> List.of(english))).containsExactly(english);
        cache.invalidate();
        assertThat(cache.get("vi", List::of)).isEmpty();
        assertThat(cache.get("en", List::of)).isEmpty();
    }

    @Test
    void loaderFailureDoesNotPoisonFutureLoads() {
        var cache = new PublishedProductListingCache();
        assertThatThrownBy(() -> cache.get("vi", () -> {
            throw new IllegalStateException("Synthetic loader failure");
        })).isInstanceOf(IllegalStateException.class);
        Product product = mock(Product.class);
        assertThat(cache.get("vi", () -> List.of(product))).containsExactly(product);
    }

    private static void await(CountDownLatch latch) {
        try {
            if (!latch.await(5, TimeUnit.SECONDS)) throw new AssertionError("Loader release timed out");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AssertionError("Loader interrupted", exception);
        }
    }
}
