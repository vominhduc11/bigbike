package com.bigbike.bigbike_backend.service.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.Category;
import com.bigbike.bigbike_backend.domain.catalog.CategorySummary;
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

class CatalogReadServiceAssistantCategorySummaryTest {

    @Test
    void countsEachSellableProductForItsVisibleParentAndChildButKeepsZeroCategories() {
        CatalogReadRepository repository = mock(CatalogReadRepository.class);
        CatalogReadService service = new CatalogReadService(
                repository,
                mock(SortParser.class),
                mock(PaginationService.class),
                mock(ProductJpaRepository.class));
        Category helmets = category("helmets", "mu-bao-hiem", "Mũ bảo hiểm", null, 1);
        Category fullface = category("fullface", "mu-bao-hiem-fullface", "Mũ fullface", "helmets", 2);
        Category gloves = category("gloves", "gang-tay", "Găng tay", null, 3);
        when(repository.findAllCategories("vi")).thenReturn(List.of(helmets, fullface, gloves));
        when(repository.findAllPublishedProductsForListing("vi")).thenReturn(List.of(
                product("fullface-safe", new CategorySummary(
                        "fullface", "mu-bao-hiem-fullface", null, "Mũ fullface", true, false),
                        BigDecimal.valueOf(1_500_000)),
                product("unsellable-price", new CategorySummary(
                        "helmets", "mu-bao-hiem", null, "Mũ bảo hiểm", true, false),
                        BigDecimal.ZERO)));

        List<CatalogReadService.AssistantCategorySummary> result =
                service.listAssistantCategorySummaries("vi");

        assertThat(result).containsExactly(
                new CatalogReadService.AssistantCategorySummary("mu-bao-hiem", "Mũ bảo hiểm", 1),
                new CatalogReadService.AssistantCategorySummary("mu-bao-hiem-fullface", "Mũ fullface", 1),
                new CatalogReadService.AssistantCategorySummary("gang-tay", "Găng tay", 0));
    }

    private static Category category(
            String id, String slug, String name, String parentId, int sortOrder) {
        return new Category(id, slug, null, name, null, parentId, null, null, null,
                null, null, null, true, false, null, sortOrder, null, null, null, null);
    }

    private static Product product(String slug, CategorySummary category, BigDecimal retailPrice) {
        return new Product(
                "product-" + slug,
                "SKU-" + slug,
                slug,
                null,
                slug,
                null,
                null,
                null,
                null,
                List.of(category),
                null,
                List.of(),
                List.of(),
                new ProductPrice(retailPrice, null, "VND"),
                List.of(),
                ProductStockState.IN_STOCK,
                Boolean.TRUE,
                PublishStatus.PUBLISHED,
                HomepageBlock.NONE,
                null,
                null,
                null,
                List.of(),
                List.of(),
                ProductHighlights.EMPTY,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(),
                List.of(),
                null,
                null,
                null,
                null,
                null,
                Instant.now(),
                Instant.now());
    }
}
