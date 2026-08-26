package com.bigbike.bigbike_backend.repository.catalog;

import static org.assertj.core.api.Assertions.assertThat;

import com.bigbike.bigbike_backend.domain.catalog.HomepageBlock;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.ProductStockState;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.ProductEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductJpaRepository;
import com.bigbike.bigbike_backend.service.common.SortDirection;
import com.bigbike.bigbike_backend.service.common.SortSpec;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** PostgreSQL regression coverage for category membership combined with name sorting. */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers
@Transactional
class CatalogPostgresQueryTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired CatalogReadRepository catalogReadRepository;
    @Autowired CategoryJpaRepository categoryRepository;
    @Autowired BrandJpaRepository brandRepository;
    @Autowired ProductJpaRepository productRepository;

    @Test
    void categoryQueriesAllowNameSortingWithoutDistinctOrderFailure() {
        String marker = UUID.randomUUID().toString();
        Instant now = Instant.now();

        CategoryEntity category = new CategoryEntity();
        category.setId("chat-category-" + marker);
        category.setSlug("chat-category-" + marker);
        category.setName("Danh mục kiểm thử trợ lý");
        category.setVisible(true);
        category.setCreatedAt(now);
        category.setUpdatedAt(now);
        categoryRepository.saveAndFlush(category);

        BrandEntity brand = new BrandEntity();
        brand.setId("chat-brand-" + marker);
        brand.setSlug("chat-brand-" + marker);
        brand.setName("Thương hiệu kiểm thử trợ lý");
        brand.setVisible(true);
        brand.setCreatedAt(now);
        brand.setUpdatedAt(now);
        brandRepository.saveAndFlush(brand);

        ProductEntity product = new ProductEntity();
        product.setId("chat-product-" + marker);
        product.setSku("CHAT-SKU-" + marker);
        product.setSlug("mu-of600-" + marker);
        product.setName("Mũ bảo hiểm OF600 kiểm thử");
        product.setBrand(brand);
        product.setCategories(List.of(category));
        product.setRetailPrice(BigDecimal.valueOf(2_790_000));
        product.setCurrency("VND");
        product.setStockState(ProductStockState.IN_STOCK);
        product.setStockQuantity(1);
        product.setManageStock(true);
        product.setAvailable(true);
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setHomepageBlock(HomepageBlock.NONE);
        product.setCreatedAt(now);
        product.setUpdatedAt(now);
        productRepository.saveAndFlush(product);

        SortSpec byName = new SortSpec("name", SortDirection.ASC);

        assertThat(catalogReadRepository.searchPublishedProductsForAssistant(
                List.of("of600"), category.getSlug(), null, null, null,
                byName, "vi", 10))
                .extracting(item -> item.slug())
                .contains(product.getSlug());

        assertThat(catalogReadRepository.findPublishedProductsPaged(
                category.getSlug(), null, null, List.of(), null, null, null,
                null, byName, 1, 10, "vi").items())
                .extracting(item -> item.slug())
                .contains(product.getSlug());
    }

    @Test
    void allProductSearchPathsIgnoreDescriptionsButKeepBilingualIdentifiersAndSku() {
        String marker = UUID.randomUUID().toString();
        Instant now = Instant.now();

        ProductEntity nameMatch = product(
                "search-name-" + marker,
                "Đồ lót trùm đầu",
                "do-lot-trum-dau-" + marker,
                "UNDERWEAR-001-" + marker,
                "Sản phẩm đồ lót.");
        ProductEntity englishNameMatch = product(
                "search-english-" + marker,
                "Đồ bảo hộ",
                "do-bao-ho-" + marker,
                "BASE-001-" + marker,
                "Lớp lót mặc trong áo bảo hộ.");
        englishNameMatch.setNameEn("Underwear Base Layer");
        englishNameMatch.setSlugEn("underwear-base-layer-" + marker);
        ProductEntity skuMatch = product(
                "search-sku-" + marker,
                "Mũ Xpeed IS-2V",
                "mu-xpeed-is-2v-" + marker,
                "LOT-REAL-123-" + marker,
                "Lót màng chống nước bên trong.");
        ProductEntity descriptionOnly = product(
                "search-description-" + marker,
                "Áo giáp Taichi RSJ354",
                "ao-giap-taichi-rsj354-" + marker,
                "TAICHI-RSJ354-" + marker,
                "Tặng kèm áo lót thun lạnh mặc trong áo bảo hộ.");
        ProductEntity helmet = product(
                "search-helmet-" + marker,
                "Mũ bảo hiểm",
                "mu-bao-hiem-" + marker,
                "HELMET-001-" + marker,
                "Mũ dùng khi đi đường.");

        for (ProductEntity product : List.of(nameMatch, englishNameMatch, skuMatch, descriptionOnly, helmet)) {
            product.setCreatedAt(now);
            product.setUpdatedAt(now);
            productRepository.save(product);
        }
        productRepository.flush();

        assertThat(catalogReadRepository.findProductsFiltered(
                "lot", "PUBLISHED", null, null, null, null, "vi"))
                .extracting(Product::id)
                .contains(nameMatch.getId(), skuMatch.getId())
                .doesNotContain(descriptionOnly.getId());

        assertThat(productRepository.findAll(ProductFilterSpecifications.build(
                "lot", Set.of(PublishStatus.PUBLISHED), false,
                null, null, Set.of(), null)))
                .extracting(ProductEntity::getId)
                .contains(nameMatch.getId(), skuMatch.getId())
                .doesNotContain(descriptionOnly.getId());

        assertThat(catalogReadRepository.findPublishedProductsPaged(
                null, null, "lot", List.of(), null, null, null,
                null, new SortSpec("name", SortDirection.ASC), 1, 100, "vi").items())
                .extracting(Product::id)
                .contains(nameMatch.getId(), skuMatch.getId())
                .doesNotContain(descriptionOnly.getId());

        assertThat(catalogReadRepository.searchPublishedProducts(List.of("lot"), "vi", 100))
                .extracting(Product::id)
                .contains(nameMatch.getId(), skuMatch.getId())
                .doesNotContain(descriptionOnly.getId());

        assertThat(catalogReadRepository.searchPublishedProductsForAssistant(
                List.of("lót"), null, null, null, null,
                new SortSpec("name", SortDirection.ASC), "vi", 100))
                .extracting(Product::id)
                .contains(nameMatch.getId(), skuMatch.getId())
                .doesNotContain(descriptionOnly.getId());

        // English identifiers are searched lexically as documented. "Underwear" must find the
        // English field even in the Vietnamese view; it is not a semantic translation of "lót".
        assertThat(catalogReadRepository.findProductsFiltered(
                "underwear", "PUBLISHED", null, null, null, null, "vi"))
                .extracting(Product::id)
                .contains(englishNameMatch.getId())
                .doesNotContain(descriptionOnly.getId());
        assertThat(productRepository.findAll(ProductFilterSpecifications.build(
                "underwear", Set.of(PublishStatus.PUBLISHED), false,
                null, null, Set.of(), null)))
                .extracting(ProductEntity::getId)
                .contains(englishNameMatch.getId())
                .doesNotContain(descriptionOnly.getId());
        assertThat(catalogReadRepository.findPublishedProductsPaged(
                null, null, "underwear", List.of(), null, null, null,
                null, new SortSpec("name", SortDirection.ASC), 1, 100, "vi").items())
                .extracting(Product::id)
                .contains(englishNameMatch.getId())
                .doesNotContain(descriptionOnly.getId());
        assertThat(catalogReadRepository.searchPublishedProducts(
                List.of("underwear"), "vi", 100))
                .extracting(Product::id)
                .contains(englishNameMatch.getId())
                .doesNotContain(descriptionOnly.getId());
        assertThat(catalogReadRepository.searchPublishedProductsForAssistant(
                List.of("underwear"), null, null, null, null,
                new SortSpec("name", SortDirection.ASC), "vi", 100))
                .extracting(Product::id)
                .contains(englishNameMatch.getId())
                .doesNotContain(descriptionOnly.getId());

        assertThat(catalogReadRepository.findPublishedProductsPaged(
                null, null, "thun lanh", List.of(), null, null, null,
                null, new SortSpec("name", SortDirection.ASC), 1, 100, "vi").items())
                .extracting(Product::id)
                .doesNotContain(descriptionOnly.getId());

        assertThat(catalogReadRepository.findPublishedProductsPaged(
                null, null, "mu bao hiem", List.of(), null, null, null,
                null, new SortSpec("name", SortDirection.ASC), 1, 100, "vi").items())
                .extracting(Product::id)
                .contains(helmet.getId());

        assertThat(catalogReadRepository.findProductsFiltered(
                "LOT-REAL-123", "PUBLISHED", null, null, null, null, "vi"))
                .extracting(Product::id)
                .contains(skuMatch.getId());
    }

    private static ProductEntity product(
            String id,
            String name,
            String slug,
            String sku,
            String shortDescription
    ) {
        ProductEntity product = new ProductEntity();
        product.setId(id);
        product.setName(name);
        product.setSlug(slug);
        product.setSku(sku);
        product.setShortDescription(shortDescription);
        product.setRetailPrice(BigDecimal.valueOf(100_000));
        product.setCurrency("VND");
        product.setStockState(ProductStockState.IN_STOCK);
        product.setStockQuantity(1);
        product.setManageStock(true);
        product.setAvailable(true);
        product.setPublishStatus(PublishStatus.PUBLISHED);
        product.setHomepageBlock(HomepageBlock.NONE);
        return product;
    }
}
