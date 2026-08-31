package com.bigbike.bigbike_backend.service.inventory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductVariantEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InventoryOutOfStockDigestServiceTest {

    @Mock
    private ProductJpaRepository productRepository;

    private InventoryOutOfStockDigestService service;

    @BeforeEach
    void setUp() {
        service = new InventoryOutOfStockDigestService(productRepository);
    }

    @Test
    void splitsFullyOutAndMissingVariantsAndExcludesNonSellingProducts() {
        Instant generatedAt = Instant.parse("2026-08-31T01:00:00Z");
        ProductEntity full = product("full", PublishStatus.PUBLISHED, false, ProductStockState.OUT_OF_STOCK);
        full.setOutOfStockSince(Instant.parse("2026-08-25T01:00:00Z"));
        full.setVariants(new ArrayList<>(List.of(
                variant("full-s", false, "2026-08-24T01:00:00Z", true),
                variant("full-m", false, "2026-08-25T01:00:00Z", true))));

        ProductEntity partial = product("partial", PublishStatus.PUBLISHED, false, ProductStockState.IN_STOCK);
        partial.setVariants(new ArrayList<>(List.of(
                variant("partial-s", false, "2026-08-20T01:00:00Z", false),
                variant("partial-m", true, null, false))));

        ProductEntity draft = product("draft", PublishStatus.DRAFT, false, ProductStockState.OUT_OF_STOCK);
        ProductEntity hidden = product("hidden", PublishStatus.HIDDEN, false, ProductStockState.OUT_OF_STOCK);
        ProductEntity trash = product("trash", PublishStatus.TRASH, false, ProductStockState.OUT_OF_STOCK);
        ProductEntity discontinued = product(
                "discontinued", PublishStatus.PUBLISHED, true, ProductStockState.OUT_OF_STOCK);
        when(productRepository.findOutOfStockDigestCandidates(PublishStatus.PUBLISHED))
                .thenReturn(List.of(full, partial, draft, hidden, trash, discontinued));

        InventoryOutOfStockDigest digest = service.build(LocalDate.of(2026, 8, 31), generatedAt);

        assertThat(digest.fullyOutOfStock()).extracting(item -> item.productId()).containsExactly("full");
        assertThat(digest.partiallyOutOfStock()).extracting(item -> item.productId()).containsExactly("partial");
        assertThat(digest.partiallyOutOfStock().get(0).unavailableVariants())
                .extracting(item -> item.variantId()).containsExactly("partial-s");
        assertThat(digest.counts().unavailableVariants()).isEqualTo(3);
        assertThat(digest.partiallyOutOfStock().get(0).outOfStockDays()).isEqualTo(11);
    }

    @Test
    void returnsEmptyWhenEverySellingProductIsAvailable() {
        ProductEntity available = product("available", PublishStatus.PUBLISHED, false, ProductStockState.IN_STOCK);
        available.setVariants(new ArrayList<>(List.of(variant("available-m", true, null, false))));
        when(productRepository.findOutOfStockDigestCandidates(PublishStatus.PUBLISHED))
                .thenReturn(List.of(available));

        InventoryOutOfStockDigest digest = service.build(
                LocalDate.of(2026, 8, 31), Instant.parse("2026-08-31T01:00:00Z"));

        assertThat(digest.isEmpty()).isTrue();
        assertThat(digest.counts().fullyOutOfStockProducts()).isZero();
        assertThat(digest.counts().partiallyOutOfStockProducts()).isZero();
    }

    @Test
    void keepsVeryLongListsCompleteAndOrderedOldestFirst() {
        List<ProductEntity> products = IntStream.range(0, 120)
                .mapToObj(index -> {
                    ProductEntity product = product(
                            "p-" + index, PublishStatus.PUBLISHED, false, ProductStockState.OUT_OF_STOCK);
                    product.setName(String.format("Sản phẩm %03d", index));
                    product.setOutOfStockSince(Instant.parse("2026-08-31T01:00:00Z").minusSeconds(index * 86_400L));
                    return product;
                })
                .toList();
        when(productRepository.findOutOfStockDigestCandidates(PublishStatus.PUBLISHED))
                .thenReturn(products);

        InventoryOutOfStockDigest digest = service.build(
                LocalDate.of(2026, 8, 31), Instant.parse("2026-08-31T01:00:00Z"));

        assertThat(digest.fullyOutOfStock()).hasSize(120);
        assertThat(digest.fullyOutOfStock().get(0).productId()).isEqualTo("p-119");
        assertThat(digest.fullyOutOfStock().get(119).productId()).isEqualTo("p-0");
    }

    private static ProductEntity product(
            String id, PublishStatus publishStatus, boolean discontinued, ProductStockState stockState
    ) {
        ProductEntity product = new ProductEntity();
        product.setId(id);
        product.setName("Sản phẩm " + id);
        product.setNameEn("Product " + id);
        product.setSku("SKU-" + id);
        product.setPublishStatus(publishStatus);
        product.setDiscontinued(discontinued);
        product.setStockState(stockState);
        product.setVariants(new ArrayList<>());
        return product;
    }

    private static ProductVariantEntity variant(
            String id, boolean available, String since, boolean estimated
    ) {
        ProductVariantEntity variant = new ProductVariantEntity();
        variant.setId(id);
        variant.setName("Biến thể " + id);
        variant.setSku("SKU-" + id);
        variant.setAvailable(available);
        variant.setStockState(available ? ProductStockState.IN_STOCK : ProductStockState.OUT_OF_STOCK);
        variant.setOutOfStockSince(since == null ? null : Instant.parse(since));
        variant.setOutOfStockSinceEstimated(estimated);
        return variant;
    }
}
