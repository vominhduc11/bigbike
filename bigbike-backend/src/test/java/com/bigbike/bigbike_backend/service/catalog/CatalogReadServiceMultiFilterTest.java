package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.BrandSummary;
import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.common.SortParser;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class CatalogReadServiceMultiFilterTest {

    @Test
    void multipleBrandsAreOrMatchedAndInStockIsAndMatched() {
        CatalogReadRepository repository = mock(CatalogReadRepository.class);
        when(repository.findAllPublishedProductsForListing("vi")).thenReturn(List.of(
                product("agv-in", "agv", ProductStockState.IN_STOCK),
                product("ls2-in", "ls2", ProductStockState.IN_STOCK),
                product("agv-out", "agv", ProductStockState.OUT_OF_STOCK),
                product("shoei-in", "shoei", ProductStockState.IN_STOCK)));
        CatalogReadService service = new CatalogReadService(
                repository, new SortParser(), new PaginationService(),
                mock(ProductJpaRepository.class), null);

        var result = service.listProducts(
                1, 20, "createdAt:desc", null, List.of("agv", "ls2"), null,
                List.of(), List.of(), List.of(), List.of(), null, null, true,
                null, "vi");

        assertThat(result.items()).extracting(Product::slug)
                .containsExactlyInAnyOrder("agv-in", "ls2-in");
        assertThat(result.totalItems()).isEqualTo(2);
    }

    private static Product product(String id, String brandSlug, ProductStockState stock) {
        Instant created = Instant.parse("2026-08-15T00:00:00Z");
        BrandSummary brand = new BrandSummary(
                "brand-" + brandSlug, brandSlug, brandSlug.toUpperCase());
        return new Product(
                "product-" + id, "SKU-" + id, id, null, id, null, null, brand, null,
                List.of(), null, List.of(), List.of(),
                new ProductPrice(BigDecimal.valueOf(1_000_000), null, "VND"), List.of(),
                stock, stock == ProductStockState.IN_STOCK, PublishStatus.PUBLISHED, false,
                null, HomepageBlock.NONE, null, null, null, List.of(), List.of(),
                ProductHighlights.EMPTY, null, null, null, null, null, null, null, null,
                List.of(), List.of(), null, null, null, null, null, created, created);
    }
}
