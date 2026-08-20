package com.bigbike.bigbike_backend.service.admin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bigbike.bigbike_backend.api.admin.dto.ProductTranslationRequest;
import com.bigbike.bigbike_backend.api.admin.dto.UpsertProductRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantOptionRequest;
import com.bigbike.bigbike_backend.api.admin.dto.VariantRequest;
import com.bigbike.bigbike_backend.api.error.ValidationException;
import com.bigbike.bigbike_backend.domain.catalog.Product;
import com.bigbike.bigbike_backend.domain.catalog.PublishStatus;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.AttributeValueEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.BrandEntity;
import com.bigbike.bigbike_backend.persistence.entity.catalog.CategoryEntity;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.AttributeValueJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.BrandJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.CategoryJpaRepository;
import com.bigbike.bigbike_backend.persistence.repository.catalog.ProductVariantJpaRepository;
import com.bigbike.bigbike_backend.repository.catalog.CatalogReadRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Reproduces the "Operation violates a data integrity constraint" 409 report on
 * product save: saving with a variant that reuses an existing SKU — either
 * held by another product, or by a sibling variant of the SAME product being
 * dropped in the same request — must never surface as a raw
 * DataIntegrityViolationException. Cross-product reuse is caught by app-layer
 * validation (ValidationException, friendly field error). Same-product reuse
 * via a dropped/re-created row is a flush-order race
 * (BUSINESS_RULES.md PRODUCT_RULE_SKU_001) fixed in
 * AdminCatalogMutationService.applyVariants by removing orphaned variants from
 * the owning collection (letting Hibernate's own orphanRemoval fire, rather
 * than a direct repository delete, which gets silently resurrected while the
 * entity is still collection-attached) and flushing before the collection is
 * replaced.
 *
 * Why 'tc' (real Postgres) and not the default H2 profile: H2 tests run with
 * ddl-auto=create-drop + Flyway disabled, so ux_product_variants_sku_lower
 * (created by migration V244, not by any entity annotation) doesn't exist in
 * that schema — the flush-order race this test guards against can't reproduce
 * there at all, so it would pass whether or not the fix is present.
 */
@SpringBootTest
@ActiveProfiles("tc")
@Testcontainers
class VariantSkuConflictTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired ProductMutationService mutationService;
    @Autowired CatalogReadRepository readRepository;
    @Autowired BrandJpaRepository brandRepo;
    @Autowired CategoryJpaRepository categoryRepo;
    @Autowired AttributeJpaRepository attributeRepo;
    @Autowired AttributeValueJpaRepository attributeValueRepo;
    @Autowired ProductVariantJpaRepository variantRepo;

    private CategoryEntity category;
    private BrandEntity brand;

    @BeforeEach
    void setup() {
        category = categoryRepo.findBySlug("test-cat-vsku").orElseGet(() -> {
            CategoryEntity c = new CategoryEntity();
            c.setId("test-cat-vsku");
            c.setSlug("test-cat-vsku");
            c.setName("Test Cat VSku");
            c.setVisible(true);
            c.setCreatedAt(Instant.now());
            c.setUpdatedAt(Instant.now());
            return categoryRepo.save(c);
        });
        brand = brandRepo.findBySlug("test-brand-vsku").orElseGet(() -> {
            BrandEntity entity = new BrandEntity();
            entity.setId("test-brand-vsku");
            entity.setSlug("test-brand-vsku");
            entity.setName("Test Brand VSku");
            entity.setVisible(true);
            entity.setCreatedAt(Instant.now());
            entity.setUpdatedAt(Instant.now());
            return brandRepo.save(entity);
        });
        ensureColorValue("Red", "red");
        ensureColorValue("Blue", "blue");
        ensureColorValue("Green", "green");
    }

    @Test
    void droppingAVariantIdWhileReusingItsSku_succeedsInsteadOfRaceConflict() {
        // ── Create a product with two variants ──
        UpsertProductRequest create = baseRequest("vsku-drop-id", "VSku Drop Id");
        create.setVariants(List.of(
                variant("FLUSH-A", "Color", "Red"),
                variant("FLUSH-B", "Color", "Blue")
        ));
        Product saved = mutationService.createProduct(create, DEV_ADMIN_ID);
        assertThat(saved.variants()).hasSize(2);
        String keptId = saved.variants().get(0).id();
        String droppedId = saved.variants().get(1).id();

        // ── Update: keep variant 1 by id, but resend variant 2's SKU on a request
        //    row with NO id — the client "forgot" the id, so applyVariants treats
        //    it as a brand-new variant while the old FLUSH-B row is orphaned. ──
        UpsertProductRequest update = baseRequest("vsku-drop-id", "VSku Drop Id");
        VariantRequest v1 = variant("FLUSH-A", "Color", "Red");
        v1.setId(keptId);
        VariantRequest v2NoId = variant("FLUSH-B", "Color", "Green");
        update.setVariants(List.of(v1, v2NoId));

        mutationService.updateProduct(saved.id(), update, DEV_ADMIN_ID);

        Product reread = readRepository.findProductById(saved.id()).orElseThrow();
        assertThat(reread.variants()).hasSize(2);
        assertThat(reread.variants().get(0).sku()).isEqualTo("FLUSH-A");
        assertThat(reread.variants().get(1).sku()).isEqualTo("FLUSH-B");
        assertThat(variantRepo.findById(droppedId))
                .as("the dropped row must actually be gone, not just orphaned in memory")
                .isEmpty();
        assertThat(reread.variants().get(1).id())
                .as("FLUSH-B is now backed by a brand-new row, not the original")
                .isNotEqualTo(droppedId);
    }

    @Test
    void variantSkuReusedByAnotherProduct_returnsFriendlyFieldError_notRaw409() {
        UpsertProductRequest other = baseRequest("vsku-other-product", "VSku Other Product");
        other.setVariants(List.of(variant("SHARED-SKU-1", "Color", "Red")));
        mutationService.createProduct(other, DEV_ADMIN_ID);

        UpsertProductRequest create = baseRequest("vsku-conflicting-product", "VSku Conflicting Product");
        create.setVariants(List.of(variant("SHARED-SKU-1", "Color", "Blue")));

        assertThatThrownBy(() -> mutationService.createProduct(create, DEV_ADMIN_ID))
                .isInstanceOf(ValidationException.class)
                .satisfies(ex -> {
                    ValidationException ve = (ValidationException) ex;
                    assertThat(ve.details())
                            .as("must be a friendly field error, not an unmapped 409")
                            .anySatisfy(d -> {
                                assertThat(d.field()).isEqualTo("variants[0].sku");
                                assertThat(d.code()).isEqualTo("DUPLICATE");
                            });
                });
    }

    @Test
    void englishSlugReusedByAnotherProduct_returnsFriendlyFieldError_notRaw409() {
        UpsertProductRequest other = baseRequest("vslug-other-product", "VSlug Other Product");
        other.setTranslations(englishNameAndSlug("Other Product EN", "shared-en-slug"));
        mutationService.createProduct(other, DEV_ADMIN_ID);

        UpsertProductRequest create = baseRequest("vslug-conflicting-product", "VSlug Conflicting Product");
        create.setTranslations(englishNameAndSlug("Conflicting Product EN", "shared-en-slug"));

        assertThatThrownBy(() -> mutationService.createProduct(create, DEV_ADMIN_ID))
                .isInstanceOf(ValidationException.class)
                .satisfies(ex -> {
                    ValidationException ve = (ValidationException) ex;
                    assertThat(ve.details())
                            .anySatisfy(d -> {
                                assertThat(d.field()).isEqualTo("translations.en.slug");
                                assertThat(d.code()).isEqualTo("DUPLICATE");
                            });
                });
    }

    private UpsertProductRequest baseRequest(String slug, String name) {
        UpsertProductRequest request = new UpsertProductRequest();
        request.setSlug(slug);
        request.setName(name);
        request.setCategoryId(category.getId());
        request.setBrandId(brand.getId());
        request.setGender("Nam");
        request.setSku("SKU-" + slug);
        request.setRetailPrice(new BigDecimal("1000000"));
        request.setPublishStatus(PublishStatus.DRAFT);
        request.setTranslations(englishName(name + " EN"));
        return request;
    }

    private VariantRequest variant(String sku, String optionName, String optionValue) {
        VariantRequest variant = new VariantRequest();
        variant.setSku(sku);
        variant.setIsAvailable(true);
        variant.setRetailPrice(BigDecimal.TEN);
        VariantOptionRequest option = new VariantOptionRequest();
        option.setOptionName(optionName);
        option.setOptionValue(optionValue);
        option.setAttributeValueId(ensureColorValue(optionValue, optionValue.toLowerCase(java.util.Locale.ROOT)).getId());
        variant.setOptions(List.of(option));
        return variant;
    }

    private AttributeValueEntity ensureColorValue(String label, String slug) {
        AttributeEntity color = attributeRepo.findByCode("color").orElseGet(() -> {
            AttributeEntity attribute = new AttributeEntity();
            attribute.setId("test-attribute-color-vsku");
            attribute.setCode("color");
            attribute.setName("Color");
            attribute.setKind("select");
            attribute.setVariation(true);
            return attributeRepo.save(attribute);
        });
        return attributeValueRepo.findByAttributeIdAndSlug(color.getId(), slug).orElseGet(() -> {
            AttributeValueEntity value = new AttributeValueEntity();
            value.setId("test-attribute-value-color-vsku-" + slug);
            value.setAttribute(color);
            value.setSlug(slug);
            value.setLabel(label);
            value.setSortOrder(0);
            return attributeValueRepo.save(value);
        });
    }

    private ProductTranslationRequest englishName(String name) {
        return new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder().name(name).build());
    }

    private ProductTranslationRequest englishNameAndSlug(String name, String slug) {
        return new ProductTranslationRequest(
                ProductTranslationRequest.ProductContentRequest.builder().name(name).slug(slug).build());
    }
}
