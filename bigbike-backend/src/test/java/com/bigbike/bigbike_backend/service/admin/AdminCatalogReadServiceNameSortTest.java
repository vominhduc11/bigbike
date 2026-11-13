package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductHighlights;
import com.bigbike.bigbike_backend.domain.catalog.ProductPrice;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import com.bigbike.bigbike_backend.service.common.PageResult;
import com.bigbike.bigbike_backend.service.common.PaginationService;
import com.bigbike.bigbike_backend.service.common.SortParser;
import java.math.BigDecimal;
import java.text.Collator;
import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import org.junit.jupiter.api.Test;

class AdminCatalogReadServiceNameSortTest {

    private final CatalogReadRepository repository = mock(CatalogReadRepository.class);
    private final AdminCatalogReadService service = new AdminCatalogReadService(
            repository, new SortParser(), new PaginationService());

    @Test
    void preservesVietnameseCaseAndCanonicalEquivalentOrderBothDirectionsAcrossPages() {
        List<Product> products = products();
        when(repository.findProductsFiltered(null, null, null, null, null, null, "vi"))
                .thenReturn(products);

        for (String direction : List.of("asc", "desc")) {
            List<Product> expected = originalOrder(products, direction);
            List<Product> actual = new ArrayList<>();
            int size = 7;
            int pages = (products.size() + size - 1) / size;
            for (int page = 1; page <= pages + 1; page++) {
                PageResult<Product> result = list(page, size, "name:" + direction, null);
                assertThat(result.totalItems()).isEqualTo(products.size());
                assertThat(result.totalPages()).isEqualTo(pages);
                actual.addAll(result.items());
            }
            assertThat(actual).containsExactlyElementsOf(expected);
            assertThat(actual.stream().map(Product::id).distinct().count()).isEqualTo(products.size());
        }
    }

    @Test
    void equalNamesAlwaysKeepAscendingIdsEvenWhenDescending() {
        List<Product> products = List.of(
                product("z", "Áo giáp", HomepageBlock.NONE),
                product("a", "ÁO GIÁP", HomepageBlock.NONE),
                product("m", Normalizer.normalize("Áo giáp", Normalizer.Form.NFD), HomepageBlock.NONE));
        when(repository.findProductsFiltered(null, null, null, null, null, null, "vi"))
                .thenReturn(products);

        for (String direction : List.of("asc", "desc")) {
            assertThat(list(1, 10, "name:" + direction, null).items())
                    .extracting(Product::id).containsExactly("a", "m", "z");
        }
    }

    @Test
    void keepsAllRepositoryFilterArgumentsAndEnglishProjection() {
        List<Product> products = List.of(
                product("en", "Helmet", HomepageBlock.NONE),
                product("fallback", "Áo giáp", HomepageBlock.NONE));
        when(repository.findProductsFiltered("Đen", "DRAFT", "IN_STOCK", "brand", "category", "Nam", "en"))
                .thenReturn(products);

        PageResult<Product> result = service.listProducts(
                1, 20, "name:asc", "Đen", "ignored", "DRAFT", "IN_STOCK",
                "brand", "category", "Nam", null, "en");

        assertThat(result.items()).containsExactlyElementsOf(originalOrder(products, "asc"));
        verify(repository).findProductsFiltered("Đen", "DRAFT", "IN_STOCK", "brand", "category", "Nam", "en");
    }

    @Test
    void homepageFilteringKeepsExactTotalsBeforePaging() {
        List<Product> products = products();
        when(repository.findProductsFiltered(null, null, null, null, null, null, "vi"))
                .thenReturn(products);
        List<Product> featured = products.stream()
                .filter(product -> product.homepageBlock() == HomepageBlock.FEATURED_GRID).toList();

        PageResult<Product> result = list(2, 3, "name:desc", "FEATURED_GRID");

        assertThat(result.totalItems()).isEqualTo(featured.size());
        assertThat(result.items()).containsExactlyElementsOf(originalOrder(featured, "desc").subList(3, 6));
    }

    @Test
    void simultaneousRequestsUseIndependentSortKeys() throws Exception {
        List<Product> products = products();
        when(repository.findProductsFiltered(null, null, null, null, null, null, "vi"))
                .thenReturn(products);
        List<Product> ascending = originalOrder(products, "asc");
        List<Product> descending = originalOrder(products, "desc");
        var executor = Executors.newFixedThreadPool(4);
        try {
            List<Callable<List<Product>>> tasks = new ArrayList<>();
            for (int index = 0; index < 24; index++) {
                String direction = index % 2 == 0 ? "asc" : "desc";
                tasks.add(() -> list(1, 1000, "name:" + direction, null).items());
            }
            var results = executor.invokeAll(tasks);
            for (int index = 0; index < results.size(); index++) {
                assertThat(results.get(index).get()).containsExactlyElementsOf(index % 2 == 0 ? ascending : descending);
            }
        } finally {
            executor.shutdownNow();
        }
    }

    private PageResult<Product> list(int page, int size, String sort, String homepageBlock) {
        return service.listProducts(page, size, sort, null, null, null, null,
                null, null, null, homepageBlock, "vi");
    }

    private static List<Product> originalOrder(List<Product> products, String direction) {
        Collator collator = Collator.getInstance(new Locale("vi"));
        collator.setStrength(Collator.SECONDARY);
        Comparator<Product> order = Comparator.comparing(Product::name, collator::compare);
        if ("desc".equals(direction)) order = order.reversed();
        return products.stream().sorted(order.thenComparing(Product::id)).toList();
    }

    private static List<Product> products() {
        String[] names = {"Áo giáp", "Mũ bảo hiểm", "Đen bóng", "đen bóng", "DEN BONG",
                "Túi đeo hông", "Ốp pô", "Ăn ten", "Âm thanh", "Kính chắn gió", "Ủng chống nước"};
        List<Product> products = new ArrayList<>();
        for (int index = 0; index < 110; index++) {
            String name = names[index % names.length] + " " + (index % 3);
            if (index % 7 == 0) name = Normalizer.normalize(name, Normalizer.Form.NFD);
            products.add(product(String.format(Locale.ROOT, "product-%03d", index), name,
                    index % 3 == 0 ? HomepageBlock.FEATURED_GRID : HomepageBlock.NONE));
        }
        Collections.shuffle(products, new Random(20261113));
        return products;
    }

    private static Product product(String id, String name, HomepageBlock block) {
        Instant created = Instant.parse("2026-08-15T00:00:00Z");
        return new Product(
                id, "SKU-" + id, id, null, name, null, null, null, null,
                List.of(), null, List.of(), List.of(),
                new ProductPrice(BigDecimal.valueOf(1_000_000), null, "VND"), List.of(),
                ProductStockState.IN_STOCK, true, PublishStatus.PUBLISHED, false,
                null, block, null, null, null, List.of(), List.of(), ProductHighlights.EMPTY,
                null, null, null, null, null, null, null, null, List.of(), List.of(),
                null, null, null, null, null, created, created);
    }
}
